#!/usr/bin/env python3
"""Run the pinned Godot compiler/import, real model tests, and scene smoke test.

No Python dependencies. Invoke from any directory:
    python tools/verify.py --godot /path/to/godot
"""
from __future__ import annotations

import argparse
import json
import os
from pathlib import Path
import re
import shutil
import subprocess
import sys

ROOT = Path(__file__).resolve().parents[1]


def run(command: list[str], timeout: int = 180, env: dict[str, str] | None = None) -> None:
    result = subprocess.run(command, cwd=ROOT, text=True, capture_output=True, timeout=timeout, env=env)
    combined = result.stdout + result.stderr
    print(combined, end="")
    # Godot can exit 0 after some import/parse errors. Do not trust exit code alone.
    if result.returncode or re.search(r"(?m)^(?:SCRIPT ERROR|ERROR):", combined):
        raise RuntimeError(f"Godot validation failed (exit {result.returncode}).")


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--godot", default="godot", help="Godot 4.5.2 standard executable")
    args = parser.parse_args()
    executable = shutil.which(args.godot)
    if executable is None:
        candidate = Path(args.godot).expanduser().resolve()
        if not candidate.is_file():
            parser.error("Godot not found. Pass --godot with the executable's full path.")
        executable = str(candidate)
    version = subprocess.check_output([executable, "--version"], text=True).strip()
    if not version.startswith("4.5.2."):
        parser.error(f"Expected the pinned Godot 4.5.2 runtime, received {version}.")
    reports = [
        ("tests/run_tests.gd", ROOT / "test-results" / "stage1.json", 18),
        ("tests/combat_tests.gd", ROOT / "test-results" / "stage2.json", 22),
        ("tests/stage3_tests.gd", ROOT / "test-results" / "stage3.json", 21),
        ("tests/stage4_tests.gd", ROOT / "test-results" / "stage4.json", 23),
        ("tests/stage5_tests.gd", ROOT / "test-results" / "stage5.json", 16),
        ("tests/campaign_tests.gd", ROOT / "test-results" / "campaign.json", 38),
    ]
    (ROOT / "test-results").mkdir(exist_ok=True)
    (ROOT / "test-results" / ".gdignore").touch()
    for _, report_path, _ in reports:
        report_path.unlink(missing_ok=True)
    python_report_path = ROOT / "test-results" / "stage5_python.json"
    python_report_path.unlink(missing_ok=True)
    common = [executable, "--headless", "--path", str(ROOT)]
    try:
        run(common + ["--editor", "--import", "--quit"])
        passed = 0
        for script, report_path, expected in reports:
            run(common + ["--script", script])
            if not report_path.is_file():
                raise RuntimeError(f"Test runner did not create {report_path.name}.")
            report = json.loads(report_path.read_text())
            if report["failed_assertions"] or report["passed"] < expected:
                raise RuntimeError(f"{report_path.name} is incomplete or contains failures.")
            passed += report["passed"]
        tool_env = dict(os.environ)
        tool_env["BUNDSCHUH_TEST_GODOT"] = executable
        run([sys.executable, "tests/test_balance_tools.py"], env=tool_env)
        python_report = json.loads(python_report_path.read_text())
        if python_report["failed_assertions"] or python_report["skipped"] or python_report["passed"] < 7:
            raise RuntimeError("Python balance tools/reload tests incomplete or failed.")
        passed += python_report["passed"]
        run([sys.executable, "tools/balance.py", "simulate", "--godot", executable,
             "--output", str(ROOT / "test-results" / "stage5_cli")])
        run(common + ["--script", "examples/stage2_backend_demo.gd"])
        run(common + ["--script", "examples/stage3_backend_demo.gd"])
        run(common + ["--script", "examples/stage4_backend_demo.gd"])
        run(common + ["--script", "tests/layout_smoke.gd"])
        run(common + ["--quit-after", "10"])
        print(f"VERIFIED: {passed} integration cases. Reports: {ROOT / 'test-results'}")
    except (RuntimeError, subprocess.SubprocessError, OSError, ValueError) as error:
        print(str(error), file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
