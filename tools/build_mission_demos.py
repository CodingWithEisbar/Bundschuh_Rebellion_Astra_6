#!/usr/bin/env python3
"""Build standalone missions with the original skirmish's complete UI and RTS loop.

Original CSS, isometric drawing, input, economy, construction and recruitment
stay shared. Only scenario data and explicit mission integration hooks differ.
"""
import argparse
import base64
import html
import json
from pathlib import Path
import re
import sys

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'tools'))
from unit_db import load


def replace_once(text, old, new):
    if text.count(old) != 1:
        raise SystemExit('Skirmish integration marker changed: ' + old[:75])
    return text.replace(old, new, 1)


def generate(check=False):
    snapshot = load(ROOT / 'data/balance/units.v1.json')
    balance = snapshot.document()
    balance['source_sha256'] = snapshot.sha256
    catalog = json.loads((ROOT / 'data/missions/campaigns.v1.json').read_text(encoding='utf-8'))
    source = (ROOT / 'data/missions/secret_oath_default.tres').read_text(encoding='utf-8')
    stealth = {key: float(re.search(rf'^{key} = ([\d.]+)$', source, re.M)[1])
               for key in ['exposure_seconds', 'decay_per_second', 'rearm_unseen_seconds', 'detection_limit']}
    original = (ROOT / 'demo/bundschuh_rebellion.html').read_text(encoding='utf-8')
    src = ROOT / 'demo/src'
    rts = json.loads((ROOT / 'data/missions/browser_rts.v1.json').read_text(encoding='utf-8'))
    # Music belongs to the mission selector; standalone gameplay stays silent.
    template = original
    template = replace_once(template, '/* MODEL_END */', (src/'mission_model.js').read_text(encoding='utf-8')+'\n/* MODEL_END */')
    template = replace_once(template, 'let game = new Game(),','let game = new MissionGame(),')
    template = replace_once(template, "chosenFaction = 'bundschuh',",'chosenFaction = PACK.mission.side,')
    template = replace_once(template, 'game = new Game(chosenFaction, seed);','game = new MissionGame(PACK.mission, seed);')
    template = replace_once(template, "const TEAM = ['#8fc7cf', '#dd8775'],", "const TEAM = ['#8fc7cf', '#dd8775', '#d8be79'],")
    core, ui = template.split('/* MODEL_END */')
    # Keep C for camp, V for idle workers, Tab for army, WASD for the camera.
    ui = ui.replace("u.type === 'villager'",'game.isWorker(u)')
    ui = replace_once(ui, 'function drawUnit(u, bodyOnly = false) {','function drawUnit(u, bodyOnly = false) {\n        if (u.tag === "cart") { drawMissionCart(u, bodyOnly); return; }')
    ui = replace_once(ui, "const cloth = u.owner === 0 ? '#79aeb5' : '#b16050',", "const cloth = u.owner === 2 ? '#d8be79' : u.owner === 0 ? '#79aeb5' : '#b16050',")
    ui = replace_once(ui, 'ctx.drawImage(ground, -H * 26 - 10, -10);','ctx.drawImage(ground, -H * 26 - 10, -10);\n        drawMissionTerrain();')
    ui = replace_once(ui, '        if (placement) {\n          const p = world(pointer.x, pointer.y),','        drawMissionWorld();\n        if (placement) {\n          const p = world(pointer.x, pointer.y),')
    ui = replace_once(ui, '        minimap();\n      }\n      function goHome()', '        updateMissionUI();\n        minimap();\n        drawMissionMinimap();\n      }\n      function goHome()')
    ui = replace_once(ui, 'function commandAt(x, y, advance = false) {','function commandAt(x, y, advance = false) {\n        if (missionBeforeCommand(x, y)) return;')
    ui = replace_once(ui, "        tone(win ? 'win' : 'lose');", "        updateMissionResult();\n        tone(win ? 'win' : 'lose');")
    ui = replace_once(ui, "        toast('Làng đang chờ lệnh. Chia dân lấy lương thực, gỗ và vàng.');", "        lastMissionNotice = '';\n        toast(PACK.mission.id + ': chia dân khai thác, xây làng và hoàn thành mục tiêu. Q chọn hero.');")
    ui = replace_once(ui, "new URLSearchParams(location.search).has('test')", "new URLSearchParams(location.search).get('test') === '1'")
    ui = replace_once(ui, '    </script>', (src/'mission_rts_ui.js').read_text(encoding='utf-8')+'\n    </script>')
    template = core+'/* MODEL_END */'+ui
    template = replace_once(template,'</style>',(src/'mission_style.css').read_text(encoding='utf-8')+'\n</style>')
    template = replace_once(template, '<p id="objective"', '<div id="mission-goals" aria-live="polite"></div><div class="mission-tools"><button data-mission-group="heroes">Hero [Q]</button><button data-mission-group="followers">Dân cứu [R]</button><button data-mission-group="transport">Xe / sứ giả [T]</button></div><p id="objective"')
    template = replace_once(template,'<p class="mobile-note">','<p class="mission-links"><a href="index.html">← Chọn nhiệm vụ khác</a></p><p class="mobile-note">')
    files = {}
    encode = lambda value: json.dumps(value, ensure_ascii=False, separators=(',', ':')).replace('<', '\\u003c')
    for spec in catalog['missions']:
        text = template
        payload = encode({'mission':spec,'stealth':stealth,'objective_profile':catalog['objective_profile'],'rts':rts})
        text = replace_once(text,'    <script>','    <script id="mission-data" type="application/json">'+payload+'</script>\n    <script>')
        text = re.sub(r'(<script id="balance-data"[^>]*>).*?(</script>)',lambda m:m[1]+encode(balance)+m[2],text,flags=re.S)
        text = replace_once(text,'<title>Bundschuh: Rebellion · Black Forest</title>','<title>'+html.escape(spec['id']+' · '+spec['title'])+' · Bundschuh: Rebellion</title>')
        files[ROOT / 'demo' / spec['file']] = text
    cards = []
    menu_missions = []
    for spec in catalog['missions']:
        campaign = 'prototype' if spec['id'] == 'P0' else spec['side']
        first = spec['id'] == 'A1'
        title = spec['title'].split(' · ')
        cards.append(
            '<button class="card" data-mission="%s" data-campaign="%s" aria-pressed="%s"%s>'
            '<span class="mission-number">%s</span><span class="card-copy"><strong>%s</strong>'
            '<small>%s</small></span><span class="card-arrow" aria-hidden="true">→</span></button>'
            % tuple(html.escape(str(v), quote=True) for v in [
                spec['id'], campaign, str(first).lower(),
                '' if campaign == 'bundschuh' else ' hidden',
                spec['id'], title[-1], title[0]]))
        menu_missions.append({key: spec[key] for key in ['id', 'file', 'title', 'place', 'brief', 'limits']}
                             | {'goals': [goal['label'] for goal in spec['goals']]})
    first = next(spec for spec in catalog['missions'] if spec['id'] == 'A1')
    menu = (src / 'mission_index.html').read_text(encoding='utf-8')
    replacements = {
        '<!-- MISSION_CARDS -->': ''.join(cards),
        '<!-- MISSIONS_DATA -->': encode(menu_missions),
        '<!-- INITIAL_PLACE -->': html.escape(first['place']),
        '<!-- INITIAL_FILE -->': html.escape(first['file'], quote=True),
        '<!-- INITIAL_TITLE -->': html.escape(first['title']),
        '<!-- INITIAL_BRIEF -->': html.escape(first['brief']),
        '<!-- INITIAL_LIMITS -->': html.escape(first['limits']),
        '<!-- INITIAL_GOALS -->': ''.join('<li>' + html.escape(goal['label']) + '</li>' for goal in first['goals']),
    }
    music = []
    for data_id, filename in [('menu-music-data', 'Wir sind des Geyers schwarzer Haufen.m4a'),
                              ('menu-music-fallback-data', 'menu_music_aac.m4a')]:
        payload = base64.b64encode((ROOT / 'sources' / filename).read_bytes()).decode('ascii')
        music.append('<script id="%s" type="audio/mp4">%s</script>' % (data_id, payload))
    replacements['<!-- MENU_MUSIC_DATA -->'] = '\n    '.join(music)
    for marker, value in replacements.items():
        menu = replace_once(menu, marker, value)
    files[ROOT / 'demo/index.html'] = menu
    stale = []
    for path, text in files.items():
        if check:
            if not path.exists() or path.read_text(encoding='utf-8') != text:
                stale.append(str(path.relative_to(ROOT)))
        else:
            path.write_text(text, encoding='utf-8')
    if stale:
        raise SystemExit('Stale mission demos; run python tools/sync_browser_demo.py: ' + ', '.join(stale))
    print('Mission demos: %d files %s' % (len(files), 'current' if check else 'generated'))


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--check', action='store_true')
    generate(parser.parse_args().check)
