#!/usr/bin/env python3
"""Convert a local file to markdown using Microsoft's markitdown library."""

import sys

from markitdown import MarkItDown


def main() -> int:
    if len(sys.argv) != 2:
        print("Usage: convert.py <file-path>", file=sys.stderr)
        return 1

    file_path = sys.argv[1]
    converter = MarkItDown(enable_plugins=False)
    result = converter.convert_local(file_path)
    print(result.text_content)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
