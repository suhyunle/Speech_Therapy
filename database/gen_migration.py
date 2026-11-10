"""schema.prisma → PostgreSQL 마이그레이션 SQL.

Prisma CLI의 스키마 엔진 바이너리를 받을 수 없는 환경을 위해 만든 생성기.
Prisma 명명 규칙(테이블 = 모델 이름, "Model_field_fkey", "Model_field_idx", "Model_field_key")을 그대로 따른다.
인터넷이 되는 환경에서는 `npx prisma migrate dev` 결과와 비교해 차이가 없는지 확인할 수 있다.

사용: python3 database/gen_migration.py backend/prisma/schema.prisma > backend/prisma/migrations/<name>/migration.sql
"""
from __future__ import annotations

import re
import sys

SCALAR = {"String": "TEXT", "Int": "INTEGER", "Boolean": "BOOLEAN", "DateTime": "TIMESTAMP(3)", "Json": "JSONB", "Float": "DOUBLE PRECISION"}


def parse(src: str):
    src = re.sub(r"//[^\n]*", "", src)
    enums = {m.group(1): m.group(2).split() for m in re.finditer(r"enum (\w+) \{([^}]*)\}", src)}
    models = {}
    for m in re.finditer(r"model (\w+) \{([^}]*)\}", src):
        fields, block = [], []
        for line in m.group(2).strip().splitlines():
            line = line.strip()
            if not line:
                continue
            if line.startswith("@@"):
                block.append(line)
                continue
            parts = line.split(None, 2)
            name, typ = parts[0], parts[1]
            attrs = parts[2] if len(parts) > 2 else ""
            fields.append({"name": name, "type": typ, "attrs": attrs})
        models[m.group(1)] = {"fields": fields, "block": block}
    return enums, models


def col_type(f, enums):
    t = f["type"].rstrip("?")
    arr = t.endswith("[]")
    t = t.rstrip("[]")
    db = re.search(r"@db\.(\w+)(?:\((\d+)\))?", f["attrs"])
    if t in enums:
        base = f'"{t}"'
    elif db and db.group(1) == "Uuid":
        base = "UUID"
    elif db and db.group(1) == "VarChar":
        base = f"VARCHAR({db.group(2)})"
    else:
        base = SCALAR[t]
    return base + ("[]" if arr else "")


def default(f, enums):
    m = re.search(r"@default\(((?:[^()]|\([^()]*\))*)\)", f["attrs"])
    if not m:
        return ""
    v = m.group(1)
    if v == "now()":
        return " DEFAULT CURRENT_TIMESTAMP"
    if v == "uuid()":
        return ""  # Prisma가 클라이언트에서 만든다
    t = f["type"].rstrip("?")
    if t in enums:
        return f" DEFAULT '{v}'"
    if t == "String":
        return f" DEFAULT {v.replace(chr(34), chr(39))}"
    return f" DEFAULT {v}"


def main(path: str):
    enums, models = parse(open(path, encoding="utf-8").read())
    out = []
    for name, vals in enums.items():
        out.append(f'-- CreateEnum\nCREATE TYPE "{name}" AS ENUM ({", ".join(repr(v).replace(chr(39), chr(39)) for v in vals)});\n')
    fks, idx = [], []
    for mname, m in models.items():
        cols, pk = [], None
        for f in m["fields"]:
            base_t = f["type"].rstrip("?").rstrip("[]")
            if base_t in models:  # relation field
                rel = re.search(r"@relation\(([^)]*)\)", f["attrs"])
                if rel and "fields:" in rel.group(1):
                    fl = re.search(r"fields: \[([^\]]+)\]", rel.group(1)).group(1).replace(" ", "").split(",")
                    rf = re.search(r"references: \[([^\]]+)\]", rel.group(1)).group(1).replace(" ", "").split(",")
                    od = re.search(r"onDelete: (\w+)", rel.group(1))
                    on_delete = {"Cascade": "CASCADE", "SetNull": "SET NULL", "Restrict": "RESTRICT"}.get(od.group(1) if od else "", None)
                    optional = any(next(x for x in m["fields"] if x["name"] == c)["type"].endswith("?") for c in fl)
                    on_delete = on_delete or ("SET NULL" if optional else "RESTRICT")
                    fks.append(
                        f'ALTER TABLE "{mname}" ADD CONSTRAINT "{mname}_{"_".join(fl)}_fkey" FOREIGN KEY ({", ".join(chr(34)+c+chr(34) for c in fl)}) '
                        f'REFERENCES "{base_t}"({", ".join(chr(34)+c+chr(34) for c in rf)}) ON DELETE {on_delete} ON UPDATE CASCADE;'
                    )
                continue
            null = "" if f["type"].endswith("?") or f["type"].endswith("[]") else " NOT NULL"
            cols.append(f'    "{f["name"]}" {col_type(f, enums)}{null}{default(f, enums)}')
            if "@id" in f["attrs"].split():
                pk = [f["name"]]
            if re.search(r"@unique\b", f["attrs"]):
                idx.append(f'CREATE UNIQUE INDEX "{mname}_{f["name"]}_key" ON "{mname}"("{f["name"]}");')
        for b in m["block"]:
            fl = re.search(r"\[([^\]]+)\]", b).group(1).replace(" ", "").split(",")
            cols_sql = ", ".join(f'"{c}"' for c in fl)
            if b.startswith("@@id"):
                pk = fl
            elif b.startswith("@@unique"):
                idx.append(f'CREATE UNIQUE INDEX "{mname}_{"_".join(fl)}_key" ON "{mname}"({cols_sql});')
            elif b.startswith("@@index"):
                idx.append(f'CREATE INDEX "{mname}_{"_".join(fl)}_idx" ON "{mname}"({cols_sql});')
        cols.append(f'\n    CONSTRAINT "{mname}_pkey" PRIMARY KEY ({", ".join(chr(34)+c+chr(34) for c in pk)})')
        out.append(f'-- CreateTable\nCREATE TABLE "{mname}" (\n' + ",\n".join(cols) + "\n);\n")
    out.append("-- CreateIndex\n" + "\n".join(idx) + "\n")
    out.append("-- AddForeignKey\n" + "\n".join(fks) + "\n")
    print("\n".join(out))


if __name__ == "__main__":
    main(sys.argv[1])
