#!/usr/bin/env python3
"""The site's Google Tag Manager setup, as code. Creates (or updates, by name) the GA4
   Google tag and the conversion events in container GTM-PKVPH96L, then publishes.

       GA4_ID=G-5D9VN9C3R2 python3 scripts/gtm-setup.py            build, then publish
       GA4_ID=G-5D9VN9C3R2 python3 scripts/gtm-setup.py --dry-run  build in the workspace, no publish

   Auth: a service account key at ~/.config/reprolegal/gtm-key.json (or GTM_KEY=path),
   added in GTM → Admin → User Management with Publish rights on the container.
   Needs: pip install google-api-python-client google-auth

   Every tag waits for analytics_storage consent, and GTM itself only loads after the
   visitor accepts (see the loader in each page's <head>), so nothing here fires for
   someone who refused.

   Events sent to GA4 (each with page_language and, for clicks, link_url):
     generate_lead      the enquiry form went through (Formspree → /thank-you)   ← mark as key event
     book_call_click    a click on the Cal.com booking link                         ← key event
     click_whatsapp     a click on a wa.me link                                     ← key event
     click_email        a click on a mailto: link
     click_phone        a click on a tel: link (none on the site yet)
     contact_open       the contact dock was opened
"""
import os, sys, time
from google.oauth2 import service_account
from googleapiclient.discovery import build
from googleapiclient.errors import HttpError

PUBLIC_ID = 'GTM-PKVPH96L'
GA4_ID = os.environ.get('GA4_ID', '').strip()
DRY = '--dry-run' in sys.argv
KEY = os.path.expanduser(os.environ.get('GTM_KEY', '~/.config/reprolegal/gtm-key.json'))
WORKSPACE = 'Default Workspace'   # the one the GTM UI edits, so nothing here competes with it
if not GA4_ID.startswith('G-'):
    raise SystemExit('Set GA4_ID=G-... (GA4 → Admin → Data streams → Measurement ID)')

creds = service_account.Credentials.from_service_account_file(KEY, scopes=[
    'https://www.googleapis.com/auth/tagmanager.edit.containers',
    'https://www.googleapis.com/auth/tagmanager.edit.containerversions',
    'https://www.googleapis.com/auth/tagmanager.publish'])
api = build('tagmanager', 'v2', credentials=creds, cache_discovery=False)

def run(req):
    """Execute a request; the Tag Manager API allows only a few queries a minute, so wait out 429s."""
    for attempt in range(8):
        try:
            return req.execute()
        except HttpError as e:
            if e.resp.status != 429 or attempt == 7: raise
            time.sleep(15 * (attempt + 1))
C = api.accounts().containers()
W = C.workspaces()

# ---- find the container --------------------------------------------------------
container = None
for acc in run(api.accounts().list()).get('account', []):
    for ct in run(C.list(parent=acc['path'])).get('container', []):
        if ct['publicId'] == PUBLIC_ID: container = ct
if not container:
    raise SystemExit('%s is not visible to %s — add it in GTM → Admin → User Management'
                     % (PUBLIC_ID, creds.service_account_email))

spaces = run(W.list(parent=container['path'])).get('workspace', [])
ws = next((w for w in spaces if w['name'] == WORKSPACE), None) or spaces[0]
P = ws['path']

# ---- helpers: create or update by name -------------------------------------------
cache = {}
cache = {}   # one listing per kind: the API quota is a handful of queries a minute
def upsert(kind, body):
    """kind is 'tags', 'triggers' or 'variables'; an item with the same name is updated in place."""
    coll = getattr(W, kind)()
    if kind not in cache: cache[kind] = run(coll.list(parent=P)).get(kind[:-1], [])
    listed = cache[kind]
    old = next((x for x in listed if x['name'] == body['name']), None)
    if old:
        return run(coll.update(path=old['path'], body=body, fingerprint=old['fingerprint']))
    return run(coll.create(parent=P, body=body))

tmpl = lambda k, v: {'type': 'template', 'key': k, 'value': v}
def cond(kind, var, value):
    return {'type': kind, 'parameter': [tmpl('arg0', var), tmpl('arg1', value)]}

# built-in click variables are off in a new container
have = {b['type'] for b in run(W.built_in_variables().list(parent=P)).get('builtInVariable', [])}
need = [t for t in ('clickUrl', 'clickElement', 'pagePath', 'event') if t not in have]
if need: run(W.built_in_variables().create(parent=P, type=need))

# ---- variables -------------------------------------------------------------------
upsert('variables', {'name': 'GA4 Measurement ID', 'type': 'c', 'parameter': [tmpl('value', GA4_ID)]})
upsert('variables', {'name': 'Page language', 'type': 'jsm', 'parameter': [tmpl('javascript',
       'function(){return document.documentElement.lang||"en";}')]})
upsert('variables', {'name': 'DLV contact_action', 'type': 'v', 'parameter': [
       {'type': 'integer', 'key': 'dataLayerVersion', 'value': '2'}, tmpl('name', 'contact_action')]})

# ---- triggers --------------------------------------------------------------------
def link_trigger(name, kind, value):
    return upsert('triggers', {'name': name, 'type': 'linkClick',
        'waitForTags': {'type': 'boolean', 'value': 'false'},
        'checkValidation': {'type': 'boolean', 'value': 'false'},
        'filter': [cond(kind, '{{Click URL}}', value)]})

INIT_ALL_PAGES = '2147479573'   # GTM's built-in "Initialization - All Pages" trigger
t_lead = upsert('triggers', {'name': 'Thank-you page (form sent)', 'type': 'pageview',
    'filter': [cond('matchRegex', '{{Page Path}}', r'^/((ua|de|fr|es|it)/)?thank-you/?$')]})
t_email = link_trigger('Click – mailto', 'startsWith', 'mailto:')
t_phone = link_trigger('Click – tel', 'startsWith', 'tel:')
t_wa = link_trigger('Click – WhatsApp', 'contains', 'wa.me/')
t_cal = link_trigger('Click – Cal.com booking', 'contains', 'cal.com/')
t_dock = upsert('triggers', {'name': 'Contact dock opened', 'type': 'customEvent',
    'customEventFilter': [cond('equals', '{{_event}}', 'contact_dock')],
    'filter': [cond('equals', '{{DLV contact_action}}', 'open')]})

# ---- tags ------------------------------------------------------------------------
NEEDS_ANALYTICS = {'consentStatus': 'needed', 'consentType': {'type': 'list', 'list': [
    {'type': 'template', 'value': 'analytics_storage'}]}}


# one Google tag only: if the container already has one, it is updated in place (keeping
# its name), otherwise it is created — two would count every page view twice
google_tag = {'name': 'GA4 – Google tag', 'type': 'googtag',
    'parameter': [tmpl('tagId', '{{GA4 Measurement ID}}'),
                  {'type': 'list', 'key': 'configSettingsTable', 'list': [{'type': 'map', 'map': [
                      tmpl('parameter', 'page_language'), tmpl('parameterValue', '{{Page language}}')]}]}],
    'firingTriggerId': [INIT_ALL_PAGES], 'consentSettings': NEEDS_ANALYTICS}
existing = next((t for t in run(W.tags().list(parent=P)).get('tag', []) if t['type'] == 'googtag'), None)
if existing:
    google_tag['name'] = existing['name']
    run(W.tags().update(path=existing['path'], body=google_tag, fingerprint=existing['fingerprint']))
else:
    run(W.tags().create(parent=P, body=google_tag))

def event_tag(name, event, trigger, with_link=True):
    params = [('page_language', '{{Page language}}')] + ([('link_url', '{{Click URL}}')] if with_link else [])
    upsert('tags', {'name': name, 'type': 'gaawe',
        'parameter': [tmpl('eventName', event), tmpl('measurementIdOverride', '{{GA4 Measurement ID}}'),
                      {'type': 'list', 'key': 'eventSettingsTable', 'list': [
                          {'type': 'map', 'map': [tmpl('parameter', k), tmpl('parameterValue', v)]} for k, v in params]}],
        'firingTriggerId': [trigger['triggerId']], 'consentSettings': NEEDS_ANALYTICS})

event_tag('GA4 – generate_lead', 'generate_lead', t_lead, with_link=False)
event_tag('GA4 – book_call_click', 'book_call_click', t_cal)
event_tag('GA4 – click_whatsapp', 'click_whatsapp', t_wa)
event_tag('GA4 – click_email', 'click_email', t_email)
event_tag('GA4 – click_phone', 'click_phone', t_phone)
event_tag('GA4 – contact_open', 'contact_open', t_dock, with_link=False)

status = run(W.getStatus(path=P))
changes = status.get('workspaceChange', [])
print('workspace "%s": %d change(s)' % (WORKSPACE, len(changes)))
for ch in status.get('mergeConflict', []): print('  conflict:', ch)
if DRY:
    print('dry run — review it in GTM, nothing published'); raise SystemExit

if not changes:
    print('nothing to publish'); raise SystemExit
ver = run(W.create_version(path=P, body={'name': 'Tracking: GA4 + contact events',
    'notes': 'scripts/gtm-setup.py'}))
if 'containerVersion' not in ver:
    raise SystemExit('version not created: %s' % ver)
pub = run(C.versions().publish(path=ver['containerVersion']['path']))
print('published version', pub['containerVersion']['containerVersionId'])
