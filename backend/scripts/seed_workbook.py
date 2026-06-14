from pathlib import Path
import sys

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.seed_data import create_workbook


target = Path(__file__).resolve().parents[1] / "data" / "portal_data.xlsx"
create_workbook(target)
print(f"Created {target}")

