#!/usr/bin/env python3
"""Build standalone missions with the original skirmish's complete UI and RTS loop.

Original CSS, isometric drawing, input, economy, construction and recruitment
stay shared. Only scenario data and explicit mission integration hooks differ.
"""
import argparse
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
    # Keep the supplied ALAC byte-for-byte in the original; mission copies embed
    # its existing AAC fallback, avoiding thirteen copies of the 31 MB ALAC block.
    template = re.sub(r'(<script id="menu-music-data"[^>]*>).*?(</script>)',r'\1\2',original,flags=re.S)
    template = replace_once(template, "let dataId = player.canPlayType('audio/mp4; codecs=\"alac\"')\n          ? 'menu-music-data'\n          : 'menu-music-fallback-data';", "let dataId = 'menu-music-fallback-data';")
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
    ui = replace_once(ui, '// Preserve the supplied lossless M4A; use the AAC copy when ALAC is unsupported.', '// Mission copies embed the AAC recording; the original retains ALAC and AAC.')
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
    for spec in catalog['missions']:
        cards.append('<a class="card" href="%s"><small>%s · %s</small><h2>%s</h2><p>%s</p><span>CHƠI OFFLINE →</span></a>' % tuple(html.escape(str(v)) for v in [spec['file'], spec['id'], 'BUNDSCHUH' if spec['side']=='bundschuh' else 'SWABIAN LEAGUE', spec['title'], spec['place']]))
    files[ROOT / 'demo/index.html'] = '''<!doctype html><html lang="vi"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>13 nhiệm vụ · Bundschuh: Rebellion</title><style>
*{box-sizing:border-box}body{margin:0;background:#142219;color:#e7dcc0;font:16px/1.6 system-ui,sans-serif}main{max-width:1240px;margin:auto;padding:64px 32px}small{font-size:12px;letter-spacing:.16em;color:#d4b46f}h1{font:clamp(36px,5vw,68px) Georgia,serif;margin:14px 0}p{color:#b5bea9;max-width:820px}.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(290px,1fr));gap:18px;margin:40px 0}.card{padding:26px;border:1px solid #52624a;background:#1c2d21;color:inherit;text-decoration:none;transition:background .2s}.card:hover{background:#2e422b;border-color:#d4b46f}.card h2{font:23px Georgia,serif;margin:16px 0}.card p{font-size:14px;min-height:44px}.card span{font-size:12px;letter-spacing:.12em;color:#9dcc9c}a{color:#d4b46f}footer{border-top:1px solid #52624a;padding-top:20px;font-size:14px}</style></head><body><main>
<small>1524–1525 / ISOMETRIC RTS MISSIONS</small><h1>Bundschuh : Rebellion</h1><p>Mười ba nhiệm vụ dùng cùng giao diện và cách chơi của <a href="bundschuh_rebellion.html">Bundschuh: Rebellion — Black Forest</a>: làng isometric, khai thác, xây dựng, tuyển quân, camera và minimap.</p><p>Mỗi HTML mở riêng, chơi offline và có nhạc menu nhúng sẵn. Giữ lệnh H/B/C xây nhà/trại lính/kho; Tab chọn quân, V chọn dân rảnh. Các nhóm nhiệm vụ dùng Q/R/T. Bản đồ, thời gian và quân số được rút gọn, không phải toàn bộ campaign GDD.</p>
<div class="grid">''' + ''.join(cards) + '''</div><footer>Mở Godot 4.5.2 → Import project.godot → F5 để chọn cùng 13 nhiệm vụ. Sandbox Stage 1–5 có nút riêng trong menu. Không cần server, CDN, npm hoặc tài khoản. Mỗi HTML nhiệm vụ là một file độc lập; liên kết chọn màn cần các file còn lại trong cùng thư mục.</footer></main></body></html>'''
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
