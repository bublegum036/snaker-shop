"""Выполнить один локальный пример со слайда: python run_example.py 23."""
import argparse
import json
from pathlib import Path

examples = json.loads(Path(__file__).with_name("snippets.json").read_text())
parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument("slide", choices=list(examples))
args = parser.parse_args()
exec(compile(examples[args.slide]["code"], f"slide_{args.slide}.py", "exec"), {})
