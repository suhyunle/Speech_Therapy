"""Allosaurus model.pt(예전 torch 저장 형식) → allosaurus_uni2005.npz. torch 없이 pickle 만으로 읽는다.
사용: python scripts/convert_allosaurus.py models/allosaurus/uni2005
"""
import collections
import pickle
import struct
import sys
from pathlib import Path

import numpy as np

DT = {"FloatStorage": np.float32, "DoubleStorage": np.float64, "LongStorage": np.int64, "IntStorage": np.int32, "HalfStorage": np.float16}


def convert(model_dir: Path) -> Path:
    storages: dict = {}

    def rebuild(storage, offset, size, stride, *a):
        return (storage, offset, tuple(size), tuple(stride))

    class U(pickle.Unpickler):
        def find_class(self, mod, name):
            if mod == "torch._utils" and name.startswith("_rebuild_tensor"):
                return rebuild
            if mod == "torch._utils" and name == "_rebuild_parameter":
                return lambda t, *a: t
            if mod == "torch" and name.endswith("Storage"):
                return name
            if mod == "collections" and name == "OrderedDict":
                return collections.OrderedDict
            raise pickle.UnpicklingError(f"허용하지 않는 객체: {mod}.{name}")

        def persistent_load(self, pid):
            _, stype, key, _loc, size = pid[:5]
            storages.setdefault(key, (stype, size))
            return key

    with open(model_dir / "model.pt", "rb") as f:
        for _ in range(3):  # magic · protocol · sys_info
            pickle.load(f)
        state = U(f).load()
        keys = pickle.load(f)
        data = {}
        for k in keys:
            n = struct.unpack("<q", f.read(8))[0]
            dt = DT[storages[k][0]]
            data[k] = np.frombuffer(f.read(n * np.dtype(dt).itemsize), dtype=dt)
    out = {}
    for name, (key, off, size, stride) in state.items():
        if not name.startswith(("blstm_layer.", "phone_layer.")):
            continue
        buf = data[key]
        out[name] = np.lib.stride_tricks.as_strided(buf[off:], shape=size, strides=[s * buf.itemsize for s in stride]).copy()
    dst = model_dir / "allosaurus_uni2005.npz"
    np.savez_compressed(dst, **out)
    return dst


if __name__ == "__main__":
    print(convert(Path(sys.argv[1])))
