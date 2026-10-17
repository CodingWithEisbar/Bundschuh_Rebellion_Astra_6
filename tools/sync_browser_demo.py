#!/usr/bin/env python3
"""Embed the validated repository unit database in the one-file offline demo.

No combat stats are authored in the HTML. --check is a cheap CI drift guard.
"""
import argparse
import json
from pathlib import Path
import re
import sys

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'tools'))
from unit_db import load


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--check', action='store_true')
    args = parser.parse_args()
    database = ROOT / 'data/balance/units.v1.json'
    snapshot = load(database)  # Validate and hash the same byte snapshot.
    data = snapshot.document()
    data['source_sha256'] = snapshot.sha256
    payload = json.dumps(data, ensure_ascii=False, separators=(',', ':')).replace('<', '\\u003c')
    path = ROOT / 'demo/bundschuh_rebellion.html'
    original = path.read_text(encoding='utf-8')
    pattern = r'(<script id="balance-data" type="application/json">).*?(</script>)'
    updated, count = re.subn(pattern, lambda m: m[1] + payload + m[2], original, flags=re.S)
    if count != 1:
        raise SystemExit('Expected exactly one balance-data script tag')
    if args.check:
        if updated != original:
            raise SystemExit('Browser stats are stale; run python tools/sync_browser_demo.py')
        print('Browser balance snapshot: current')
    else:
        path.write_text(updated, encoding='utf-8')
        print(f'Embedded {len(data["units"])} units in {path.relative_to(ROOT)}')
    from build_mission_demos import generate
    generate(args.check)


if __name__ == '__main__':
    main()
