#!/usr/bin/env python3

# Copyright 2026 bittuhere
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
#     http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.

"""
aplicense.py — Apply the Apache License 2.0 to any project, interactively.

Works with: HTML, CSS, JavaScript, TypeScript, React (JSX/TSX), Vue, Svelte,
Python, Go, Rust, Java, C/C++, Ruby, PHP, Shell, YAML, Markdown, and more.

What it does:
  • Creates a LICENSE file with the full Apache 2.0 text, filled in with your
    copyright holder and year.
  • Creates a NOTICE file (Apache 2.0 convention).
  • Updates package.json → "license": "Apache-2.0" (Node / React projects).
  • Updates pyproject.toml / Cargo.toml / composer.json when present.
  • Adds the standard Apache 2.0 header to every source file using the correct
    comment syntax for that file type (respects shebangs, XML declarations,
    HTML DOCTYPE, and Markdown frontmatter).
  • Idempotent — running it twice won't double-insert headers.

Usage:
    python aplicense.py                       # interactive, current folder
    python aplicense.py /path/to/project      # interactive, other folder
    python aplicense.py --yes .               # non-interactive (accept defaults)
    python aplicense.py --dry-run .           # preview changes only
"""

import argparse
import json
import os
import re
import subprocess
import sys
from datetime import datetime
from pathlib import Path

__version__ = "1.0.0"


# ─────────────────────────────────────────────────────────────────────────────
#  Colours
# ─────────────────────────────────────────────────────────────────────────────

def _supports_color():
    if os.environ.get("NO_COLOR"):
        return False
    if os.environ.get("FORCE_COLOR"):
        return True
    if not hasattr(sys.stdout, "isatty") or not sys.stdout.isatty():
        return False
    return True

_C = _supports_color()

class C:
    RESET  = "\033[0m"  if _C else ""
    BOLD   = "\033[1m"  if _C else ""
    DIM    = "\033[2m"  if _C else ""
    GREEN  = "\033[32m" if _C else ""
    YELLOW = "\033[33m" if _C else ""
    RED    = "\033[31m" if _C else ""
    CYAN   = "\033[36m" if _C else ""
    BLUE   = "\033[34m" if _C else ""


# ─────────────────────────────────────────────────────────────────────────────
#  The full Apache License 2.0 text (verbatim)
# ─────────────────────────────────────────────────────────────────────────────

APACHE_2_0_LICENSE = """                                 Apache License
                           Version 2.0, January 2004
                        http://www.apache.org/licenses/

   TERMS AND CONDITIONS FOR USE, REPRODUCTION, AND DISTRIBUTION

   1. Definitions.

      "License" shall mean the terms and conditions for use, reproduction,
      and distribution as defined by Sections 1 through 9 of this document.

      "Licensor" shall mean the copyright owner or entity authorized by
      the copyright owner that is granting the License.

      "Legal Entity" shall mean the union of the acting entity and all
      other entities that control, are controlled by, or are under common
      control with that entity. For the purposes of this definition,
      "control" means (i) the power, direct or indirect, to cause the
      direction or management of such entity, whether by contract or
      otherwise, or (ii) ownership of fifty percent (50%) or more of the
      outstanding shares, or (iii) beneficial ownership of such entity.

      "You" (or "Your") shall mean an individual or Legal Entity
      exercising permissions granted by this License.

      "Source" form shall mean the preferred form for making modifications,
      including but not limited to software source code, documentation
      source, and configuration files.

      "Object" form shall mean any form resulting from mechanical
      transformation or translation of a Source form, including but
      not limited to compiled object code, generated documentation,
      and conversions to other media types.

      "Work" shall mean the work of authorship, whether in Source or Object
      form, made available under the License, as indicated by a
      copyright notice that is included in or attached to the work
      (an example is provided in the Appendix below).

      "Derivative Works" shall mean any work, whether in Source or Object
      form, that is based on (or derived from) the Work and for which the
      editorial revisions, annotations, elaborations, or other modifications
      represent, as a whole, an original work of authorship. For the purposes
      of this License, Derivative Works shall not include works that remain
      separable from, or merely link (or bind by name) to the interfaces of,
      the Work and Derivative Works thereof.

      "Contribution" shall mean any work of authorship, including
      the original version of the Work and any modifications or additions
      to that Work or Derivative Works thereof, that is intentionally
      submitted to Licensor for inclusion in the Work by the copyright owner
      or by an individual or Legal Entity authorized to submit on behalf of
      the copyright owner. For the purposes of this definition, "submitted"
      means any form of electronic, verbal, or written communication sent
      to the Licensor or its representatives, including but not limited to
      communication on electronic mailing lists, source code control systems,
      and issue tracking systems that are managed by, or on behalf of, the
      Licensor for the purpose of discussing and improving the Work, but
      excluding communication that is conspicuously marked or otherwise
      designated in writing by the copyright owner as "Not a Contribution."

      "Contributor" shall mean Licensor and any individual or Legal Entity
      on behalf of whom a Contribution has been received by Licensor and
      subsequently incorporated within the Work.

   2. Grant of Copyright License. Subject to the terms and conditions of
      this License, each Contributor hereby grants to You a perpetual,
      worldwide, non-exclusive, no-charge, royalty-free, irrevocable
      copyright license to reproduce, prepare Derivative Works of,
      publicly display, publicly perform, sublicense, and distribute the
      Work and such Derivative Works in Source or Object form.

   3. Grant of Patent License. Subject to the terms and conditions of
      this License, each Contributor hereby grants to You a perpetual,
      worldwide, non-exclusive, no-charge, royalty-free, irrevocable
      (except as stated in this section) patent license to make, have made,
      use, offer to sell, sell, import, and otherwise transfer the Work,
      where such license applies only to those patent claims licensable
      by such Contributor that are necessarily infringed by their
      Contribution(s) alone or by combination of their Contribution(s)
      with the Work to which such Contribution(s) was submitted. If You
      institute patent litigation against any entity (including a
      cross-claim or counterclaim in a lawsuit) alleging that the Work
      or a Contribution incorporated within the Work constitutes direct
      or contributory patent infringement, then any patent licenses
      granted to You under this License for that Work shall terminate
      as of the date such litigation is filed.

   4. Redistribution. You may reproduce and distribute copies of the
      Work or Derivative Works thereof in any medium, with or without
      modifications, and in Source or Object form, provided that You
      meet the following conditions:

      (a) You must give any other recipients of the Work or
          Derivative Works a copy of this License; and

      (b) You must cause any modified files to carry prominent notices
          stating that You changed the files; and

      (c) You must retain, in the Source form of any Derivative Works
          that You distribute, all copyright, patent, trademark, and
          attribution notices from the Source form of the Work,
          excluding those notices that do not pertain to any part of
          the Derivative Works; and

      (d) If the Work includes a "NOTICE" text file as part of its
          distribution, then any Derivative Works that You distribute must
          include a readable copy of the attribution notices contained
          within such NOTICE file, excluding those notices that do not
          pertain to any part of the Derivative Works, in at least one
          of the following places: within a NOTICE text file distributed
          as part of the Derivative Works; within the Source form or
          documentation, if provided along with the Derivative Works; or,
          within a display generated by the Derivative Works, if and
          wherever such third-party notices normally appear. The contents
          of the NOTICE file are for informational purposes only and
          do not modify the License. You may add Your own attribution
          notices within Derivative Works that You distribute, alongside
          or as an addendum to the NOTICE text from the Work, provided
          that such additional attribution notices cannot be construed
          as modifying the License.

      You may add Your own copyright statement to Your modifications and
      may provide additional or different license terms and conditions
      for use, reproduction, or distribution of Your modifications, or
      for any such Derivative Works as a whole, provided Your use,
      reproduction, and distribution of the Work otherwise complies with
      the conditions stated in this License.

   5. Submission of Contributions. Unless You explicitly state otherwise,
      any Contribution intentionally submitted for inclusion in the Work
      by You to the Licensor shall be under the terms and conditions of
      this License, without any additional terms or conditions.
      Notwithstanding the above, nothing herein shall supersede or modify
      the terms of any separate license agreement you may have executed
      with Licensor regarding such Contributions.

   6. Trademarks. This License does not grant permission to use the trade
      names, trademarks, service marks, or product names of the Licensor,
      except as required for reasonable and customary use in describing the
      origin of the Work and reproducing the content of the NOTICE file.

   7. Disclaimer of Warranty. Unless required by applicable law or
      agreed to in writing, Licensor provides the Work (and each
      Contributor provides its Contributions) on an "AS IS" BASIS,
      WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or
      implied, including, without limitation, any warranties or conditions
      of TITLE, NON-INFRINGEMENT, MERCHANTABILITY, or FITNESS FOR A
      PARTICULAR PURPOSE. You are solely responsible for determining the
      appropriateness of using or redistributing the Work and assume any
      risks associated with Your exercise of permissions under this License.

   8. Limitation of Liability. In no event and under no legal theory,
      whether in tort (including negligence), contract, or otherwise,
      unless required by applicable law (such as deliberate and grossly
      negligent acts) or agreed to in writing, shall any Contributor be
      liable to You for damages, including any direct, indirect, special,
      incidental, or consequential damages of any character arising as a
      result of this License or out of the use or inability to use the
      Work (including but not limited to damages for loss of goodwill,
      work stoppage, computer failure or malfunction, or any and all
      other commercial damages or losses), even if such Contributor
      has been advised of the possibility of such damages.

   9. Accepting Warranty or Additional Liability. While redistributing
      the Work or Derivative Works thereof, You may choose to offer,
      and charge a fee for, acceptance of support, warranty, indemnity,
      or other liability obligations and/or rights consistent with this
      License. However, in accepting such obligations, You may act only
      on Your own behalf and on Your sole responsibility, not on behalf
      of any other Contributor, and only if You agree to indemnify,
      defend, and hold each Contributor harmless for any liability
      incurred by, or claims asserted against, such Contributor by reason
      of your accepting any such warranty or additional liability.

   END OF TERMS AND CONDITIONS

   APPENDIX: How to apply the Apache License to your work.

      To apply the Apache License to your work, attach the following
      boilerplate notice, with the fields enclosed by brackets "[]"
      replaced with your own identifying information. (Don't include
      the brackets!)  The text should be enclosed in the appropriate
      comment syntax for the file format. We also recommend that a
      file or class name and description of purpose be included on the
      same "printed page" as the copyright notice for easier
      identification within third-party archives.

   Copyright [yyyy] [name of copyright owner]

   Licensed under the Apache License, Version 2.0 (the "License");
   you may not use this file except in compliance with the License.
   You may obtain a copy of the License at

       http://www.apache.org/licenses/LICENSE-2.0

   Unless required by applicable law or agreed to in writing, software
   distributed under the License is distributed on an "AS IS" BASIS,
   WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
   See the License for the specific language governing permissions and
   limitations under the License.
"""


# ─────────────────────────────────────────────────────────────────────────────
#  File-type tables
# ─────────────────────────────────────────────────────────────────────────────

SKIP_DIRS = {
    ".git", ".svn", ".hg", ".bzr",
    "node_modules", "bower_components", "jspm_packages",
    "dist", "build", "out", "target", "bin", "obj", "release",
    "vendor", "third_party", "thirdparty", "external",
    "__pycache__", ".pytest_cache", ".mypy_cache", ".ruff_cache",
    ".venv", "venv", "env", ".env", ".virtualenv",
    ".idea", ".vscode", ".vs", ".fleet",
    ".next", ".nuxt", ".cache", ".parcel-cache", ".turbo", ".svelte-kit",
    "coverage", ".nyc_output", ".coverage", "htmlcov",
    ".gradle", ".m2", ".mvn", "Pods", "Carthage", "DerivedData",
    ".terraform", ".serverless", ".aws-sam",
    ".pytest_temp", ".tox", ".eggs", "*.egg-info",
}

SKIP_FILENAMES = {
    "license", "license.txt", "license.md", "licence", "licence.txt",
    "notice", "notice.txt", "notice.md",
    "package-lock.json", "npm-shrinkwrap.json", "yarn.lock", "pnpm-lock.yaml",
    "cargo.lock", "composer.lock", "gemfile.lock", "poetry.lock", "pipfile.lock",
    "readme", "readme.md", "readme.txt", "readme.rst",
    "changelog", "changelog.md", "changes", "changes.md",
    "contributing.md", "code_of_conduct.md", "security.md",
    ".gitignore", ".gitattributes", ".npmignore", ".dockerignore",
    ".editorconfig", ".prettierrc", ".prettierrc.json", ".eslintrc", ".eslintrc.json",
    ".babelrc", ".browserslistrc", ".nvmrc", ".python-version", ".ruby-version",
    ".htaccess", ".htpasswd", "robots.txt", "humans.txt",
}

SKIP_EXTS = {
    # Images
    ".png", ".jpg", ".jpeg", ".gif", ".webp", ".ico", ".icns", ".bmp", ".tiff", ".tif",
    # Audio / video
    ".mp3", ".mp4", ".wav", ".ogg", ".oga", ".webm", ".mov", ".avi", ".mkv", ".flac", ".m4a",
    # Archives
    ".zip", ".tar", ".gz", ".tgz", ".bz2", ".7z", ".rar", ".xz", ".zst",
    # Documents
    ".pdf", ".doc", ".docx", ".xls", ".xlsx", ".ppt", ".pptx", ".odt",
    # Binaries
    ".exe", ".dll", ".so", ".dylib", ".bin", ".o", ".a", ".lib", ".class", ".jar", ".war",
    ".pyc", ".pyo", ".pyd", ".wasm",
    # Fonts
    ".woff", ".woff2", ".ttf", ".otf", ".eot",
    # Data / locks
    ".lock", ".db", ".sqlite", ".sqlite3", ".mdb",
    # Minified (unsafe to touch)
    ".min.js", ".min.css",
    # Certificates / keys
    ".pem", ".crt", ".cer", ".key", ".p12", ".pfx", ".jks",
    # Maps
    ".map",
}

# Extension → comment style. `None` means "has comments but skip by default".
STYLE_BY_EXT = {}
for e in (".py", ".pyi", ".sh", ".bash", ".zsh", ".fish", ".ksh",
          ".rb", ".pl", ".pm", ".r", ".jl", ".tcl", ".awk",
          ".yaml", ".yml", ".toml", ".ini", ".cfg", ".conf",
          ".properties", ".tf", ".tfvars", ".mk", ".cmake",
          ".dockerfile", ".ps1", ".psm1", ".psd1", ".gemspec", ".rake"):
    STYLE_BY_EXT[e] = "hash"

for e in (".c", ".h", ".cpp", ".cc", ".cxx", ".c++", ".hpp", ".hxx", ".h++", ".hh",
          ".java", ".kt", ".kts", ".scala", ".sc", ".groovy", ".go", ".rs",
          ".swift", ".m", ".mm", ".php", ".cs",
          ".css", ".scss", ".sass", ".less", ".styl", ".stylus",
          ".js", ".mjs", ".cjs", ".jsx", ".ts", ".tsx", ".mts", ".cts",
          ".graphql", ".gql", ".proto", ".idl", ".glsl", ".hlsl", ".vert", ".frag"):
    STYLE_BY_EXT[e] = "block"

for e in (".html", ".htm", ".xhtml", ".shtml",
          ".xml", ".xsl", ".xslt", ".xsd", ".wsdl", ".plist", ".rss", ".atom",
          ".svg",
          ".md", ".markdown", ".mdown", ".mkd",
          ".vue", ".svelte", ".astro",
          ".ejs", ".hbs", ".handlebars", ".mustache", ".njk", ".liquid", ".twig",
          ".jsp", ".asp", ".aspx", ".erb"):
    STYLE_BY_EXT[e] = "html"

# Files with no extension → assumed style
STYLE_BY_NAME = {
    "makefile": "hash",
    "gnumakefile": "hash",
    "dockerfile": "hash",
    "containerfile": "hash",
    "rakefile": "hash",
    "gemfile": "hash",
    "guardfile": "hash",
    "procfile": "hash",
    "vagrantfile": "hash",
    "brewfile": "hash",
    "cakefile": "hash",
    "justfile": "hash",
    "jenkinsfile": "hash",
    "cmakelists.txt": "hash",
    "caddyfile": "hash",
    "nginx.conf": "hash",
}

MAX_FILE_BYTES = 1_500_000     # skip files larger than ~1.5 MB
HEADER_MARKER  = "Licensed under the Apache License"


# ─────────────────────────────────────────────────────────────────────────────
#  Small helpers
# ─────────────────────────────────────────────────────────────────────────────

def die(msg, code=1):
    print(f"{C.RED}✗  {msg}{C.RESET}", file=sys.stderr)
    sys.exit(code)


def hr(char="─", n=64):
    print(f"{C.DIM}{char * n}{C.RESET}")


def banner():
    print()
    print(f"{C.BOLD}{C.CYAN}  aplicense.py{C.RESET}  {C.DIM}·{C.RESET}  Apache License 2.0"
          f"  {C.DIM}v{__version__}{C.RESET}")
    hr()


def prompt(text, default=None, allow_empty=False):
    if default not in (None, ""):
        full = f"  {text} {C.DIM}[{default}]{C.RESET}: "
    else:
        full = f"  {text}: "
    while True:
        try:
            val = input(full).strip()
        except (EOFError, KeyboardInterrupt):
            print()
            sys.exit(130)
        if val:
            return val
        if default is not None:
            return default
        if allow_empty:
            return ""
        print(f"    {C.RED}This field is required.{C.RESET}")


def prompt_yesno(text, default=True):
    suffix = f" {C.DIM}[Y/n]{C.RESET}: " if default else f" {C.DIM}[y/N]{C.RESET}: "
    try:
        val = input(f"  {text}{suffix}").strip().lower()
    except (EOFError, KeyboardInterrupt):
        print()
        sys.exit(130)
    if not val:
        return default
    return val in ("y", "yes", "t", "true", "1")


def guess_holder():
    # 1. git config
    try:
        out = subprocess.check_output(
            ["git", "config", "--get", "user.name"],
            stderr=subprocess.DEVNULL, timeout=2,
        ).decode("utf-8", "replace").strip()
        if out:
            return out
    except Exception:
        pass
    # 2. environment
    for key in ("GIT_AUTHOR_NAME", "USER", "USERNAME", "LOGNAME"):
        v = os.environ.get(key)
        if v:
            return v
    return "Your Name"


def read_text(path):
    """Return (text, encoding) or raise on undecodable binary."""
    raw = path.read_bytes()
    for enc in ("utf-8", "utf-8-sig", "cp1252", "latin-1"):
        try:
            return raw.decode(enc), enc
        except UnicodeDecodeError:
            continue
    raise ValueError("Could not decode file")


def write_text(path, text, encoding):
    path.write_text(text, encoding=encoding, newline="")  # preserve LF/CRLF


# ─────────────────────────────────────────────────────────────────────────────
#  File classification
# ─────────────────────────────────────────────────────────────────────────────

def style_for(path: Path):
    """Return 'hash' | 'block' | 'html' | None."""
    name = path.name
    lname = name.lower()

    if lname in SKIP_FILENAMES:
        return None
    if lname.startswith("license") or lname.startswith("notice"):
        return None
    if lname.startswith(".") and "." not in lname[1:]:
        # dotfiles like .gitignore, .env — skip
        return None

    # Compound extensions (.min.js)
    lower_full = lname
    for ext in (".min.js", ".min.css", ".min.mjs", ".map"):
        if lower_full.endswith(ext):
            return None

    ext = path.suffix.lower()
    if ext in SKIP_EXTS:
        return None

    if ext in STYLE_BY_EXT:
        return STYLE_BY_EXT[ext]

    # No extension → look up by name
    if not ext:
        return STYLE_BY_NAME.get(lname)

    return None


def walk_source_files(root: Path):
    """Yield (path, style) for every source file we should touch."""
    for dirpath, dirnames, filenames in os.walk(root):
        dirnames[:] = [d for d in dirnames if d not in SKIP_DIRS and not d.startswith(".")]
        for fname in filenames:
            p = Path(dirpath) / fname
            style = style_for(p)
            if style:
                yield p, style


# ─────────────────────────────────────────────────────────────────────────────
#  Header generation & insertion
# ─────────────────────────────────────────────────────────────────────────────

def build_header_body(holder, year):
    return (
        f"Copyright {year} {holder}\n"
        f"\n"
        f"Licensed under the Apache License, Version 2.0 (the \"License\");\n"
        f"you may not use this file except in compliance with the License.\n"
        f"You may obtain a copy of the License at\n"
        f"\n"
        f"    http://www.apache.org/licenses/LICENSE-2.0\n"
        f"\n"
        f"Unless required by applicable law or agreed to in writing, software\n"
        f"distributed under the License is distributed on an \"AS IS\" BASIS,\n"
        f"WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.\n"
        f"See the License for the specific language governing permissions and\n"
        f"limitations under the License.\n"
    )


def wrap_as_comment(body, style):
    lines = body.rstrip("\n").split("\n")
    if style == "hash":
        return "\n".join(("# " + l).rstrip() for l in lines) + "\n"
    if style == "block":
        inner = "\n".join((" * " + l).rstrip() for l in lines)
        return f"/*\n{inner}\n */\n"
    if style == "html":
        inner = "\n".join(("  " + l).rstrip() for l in lines)
        return f"<!--\n{inner}\n-->\n"
    return ""


def compute_insert_line(lines):
    if not lines:
        return 0
    first = lines[0]
    stripped = first.lstrip()

    # Shebang → insert after
    if first.startswith("#!"):
        idx = 1
        # PEP 263 encoding comment
        if idx < len(lines) and re.search(r"coding[:=]\s*[\w\-]+", lines[idx]):
            idx += 1
        return idx

    # XML declaration
    if stripped.startswith("<?xml"):
        return 1

    # PHP opening tag
    if stripped.startswith("<?php"):
        return 1

    # HTML DOCTYPE (quirks-mode safety)
    if stripped.lower().startswith("<!doctype"):
        return 1

    # YAML frontmatter (Jekyll, Hugo, Astro, etc.)
    if first.strip() == "---":
        for i in range(1, min(len(lines), 500)):
            if lines[i].strip() in ("---", "..."):
                return i + 1

    return 0


def insert_header(text, header_block):
    lines = text.split("\n")
    idx = compute_insert_line(lines)
    header_lines = header_block.rstrip("\n").split("\n")

    before = lines[:idx]
    after = lines[idx:]

    # Avoid stacking three blank lines
    while after and after[0].strip() == "":
        after.pop(0)

    new_lines = before + [""] + header_lines + [""] + after
    # If file was empty, don't start with blank line
    if not before:
        while new_lines and new_lines[0] == "":
            new_lines.pop(0)
    return "\n".join(new_lines)


def already_has_header(text):
    head = text[:3000]
    return HEADER_MARKER in head


# ─────────────────────────────────────────────────────────────────────────────
#  Config-file updates
# ─────────────────────────────────────────────────────────────────────────────

def update_package_json(path: Path, dry_run=False):
    try:
        raw = path.read_text(encoding="utf-8")
        data = json.loads(raw)
    except Exception as e:
        return f"skipped ({e.__class__.__name__})"
    if not isinstance(data, dict):
        return "skipped (not an object)"
    old = data.get("license")
    if old == "Apache-2.0":
        return "already Apache-2.0"
    data["license"] = "Apache-2.0"
    if not dry_run:
        path.write_text(json.dumps(data, indent=2, ensure_ascii=False) + "\n",
                        encoding="utf-8")
    return f"license: {old!r} → 'Apache-2.0'"


def _update_toml_license(path: Path, section: str, dry_run=False):
    try:
        text = path.read_text(encoding="utf-8")
    except Exception as e:
        return f"skipped ({e.__class__.__name__})"

    # Already set?
    m = re.search(r'^\s*license\s*=\s*(.+)$', text, re.M)
    if m:
        current = m.group(1).strip()
        if "Apache-2.0" in current:
            return "already Apache-2.0"
        text = re.sub(r'^\s*license\s*=.*$', 'license = "Apache-2.0"',
                      text, count=1, flags=re.M)
    else:
        # Insert under [project] (PEP 621) or [package] (Cargo)
        sec_re = re.compile(r'^\[{}\]\s*$'.format(re.escape(section)), re.M)
        ms = sec_re.search(text)
        if not ms:
            return f"no [{section}] section"
        pos = ms.end()
        text = text[:pos] + '\nlicense = "Apache-2.0"' + text[pos:]

    if not dry_run:
        path.write_text(text, encoding="utf-8")
    return 'license = "Apache-2.0"'


def update_composer_json(path: Path, dry_run=False):
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
    except Exception as e:
        return f"skipped ({e.__class__.__name__})"
    if not isinstance(data, dict):
        return "skipped"
    old = data.get("license")
    if old == "Apache-2.0":
        return "already Apache-2.0"
    data["license"] = "Apache-2.0"
    if not dry_run:
        path.write_text(json.dumps(data, indent=4, ensure_ascii=False) + "\n",
                        encoding="utf-8")
    return f"license: {old!r} → 'Apache-2.0'"


# ─────────────────────────────────────────────────────────────────────────────
#  Build LICENSE / NOTICE
# ─────────────────────────────────────────────────────────────────────────────

def render_license_file(holder, year):
    """
    Fill in the appendix copyright at the bottom of the license text.
    The Apache 2.0 license text itself should stay verbatim; we replace only
    the two [placeholder] tokens in the appendix example.
    """
    text = APACHE_2_0_LICENSE
    text = text.replace("Copyright [yyyy] [name of copyright owner]",
                        f"Copyright {year} {holder}")
    return text


def render_notice_file(project, holder, year, email, website):
    lines = [
        project,
        f"Copyright {year} {holder}",
        "",
        "This product includes software developed as part of the",
        f"{project} project.",
    ]
    if website:
        lines += ["", f"Project home: {website}"]
    if email:
        lines += ["", f"Contact: {email}"]
    lines += [
        "",
        "Licensed under the Apache License, Version 2.0 (the \"License\");",
        "you may not use this file except in compliance with the License.",
        "You may obtain a copy of the License at",
        "",
        "    http://www.apache.org/licenses/LICENSE-2.0",
        "",
        "Unless required by applicable law or agreed to in writing, software",
        "distributed under the License is distributed on an \"AS IS\" BASIS,",
        "WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.",
        "See the License for the specific language governing permissions and",
        "limitations under the License.",
        "",
    ]
    return "\n".join(lines)


# ─────────────────────────────────────────────────────────────────────────────
#  Main
# ─────────────────────────────────────────────────────────────────────────────

def main():
    ap = argparse.ArgumentParser(
        prog="aplicense.py",
        description="Add the Apache License 2.0 to any project, interactively.",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="Example:\n"
               "  python aplicense.py ./my-web-app\n"
               "  python aplicense.py --yes ./my-lib --name my-lib --holder 'Jane Doe'\n",
    )
    ap.add_argument("directory", nargs="?", default=None,
                    help="Project root (default: current directory)")
    ap.add_argument("-y", "--yes", action="store_true",
                    help="Non-interactive: accept defaults / skip prompts")
    ap.add_argument("--dry-run", action="store_true",
                    help="Show what would change without writing anything")
    ap.add_argument("--no-headers", action="store_true",
                    help="Do not inject headers into source files")
    ap.add_argument("--no-config", action="store_true",
                    help="Do not update package.json / pyproject.toml / etc.")
    ap.add_argument("--no-notice", action="store_true",
                    help="Do not create a NOTICE file")
    ap.add_argument("--name",   help="Project name")
    ap.add_argument("--holder", help="Copyright holder")
    ap.add_argument("--year",   help="Copyright year (default: current)")
    ap.add_argument("--email",  help="Contact email (optional, for NOTICE)")
    ap.add_argument("--website", help="Project website (optional, for NOTICE)")
    ap.add_argument("-V", "--version", action="version",
                    version=f"aplicense.py {__version__}")
    args = ap.parse_args()

    banner()

    # ── Resolve root ──────────────────────────────────────────────────────
    root = Path(args.directory or ".").resolve()
    if not root.exists():
        die(f"Path does not exist: {root}")
    if not root.is_dir():
        die(f"Not a directory: {root}")

    print(f"  {C.DIM}Project root:{C.RESET} {root}")

    # ── Collect info ──────────────────────────────────────────────────────
    default_name   = args.name   or root.name or "my-project"
    default_holder = args.holder or guess_holder()
    default_year   = args.year   or str(datetime.now().year)

    interactive = not args.yes

    if interactive:
        print()
        print(f"  {C.BOLD}Project information{C.RESET}")
        hr()
        project = args.name   or prompt("Project name", default_name)
        holder  = args.holder or prompt("Copyright holder", default_holder)
        year    = args.year   or prompt("Year", default_year)
        email   = args.email  or prompt("Contact email (optional, for NOTICE)",
                                        "", allow_empty=True)
        website = args.website or prompt("Project website (optional, for NOTICE)",
                                        "", allow_empty=True)
    else:
        project = default_name
        holder  = default_holder
        year    = default_year
        email   = args.email   or ""
        website = args.website or ""

    if not project:
        die("Project name cannot be empty.")
    if not holder:
        die("Copyright holder cannot be empty.")
    if not re.match(r"^\d{4}(-\d{4})?$", year):
        print(f"  {C.YELLOW}⚠  '{year}' doesn't look like a year — using as-is.{C.RESET}")

    # ── Scan files ────────────────────────────────────────────────────────
    print()
    print(f"  {C.DIM}Scanning source files…{C.RESET}")
    to_header   = []   # (path, style)
    header_stats = {"hash": 0, "block": 0, "html": 0}
    skipped_binary = 0

    for p, style in walk_source_files(root):
        try:
            if p.stat().st_size > MAX_FILE_BYTES:
                continue
        except OSError:
            continue
        try:
            text, _ = read_text(p)
        except Exception:
            skipped_binary += 1
            continue
        if already_has_header(text):
            continue
        to_header.append((p, style, text))
        header_stats[style] = header_stats.get(style, 0) + 1

    total_source = len(to_header)

    # ── Detect project kind for the summary ──────────────────────────────
    markers = []
    if (root / "package.json").exists():       markers.append("Node / React")
    if (root / "pyproject.toml").exists():     markers.append("Python (PEP 621)")
    if (root / "setup.py").exists():           markers.append("Python (legacy)")
    if (root / "Cargo.toml").exists():         markers.append("Rust")
    if (root / "composer.json").exists():      markers.append("PHP")
    if (root / "go.mod").exists():             markers.append("Go")
    if (root / "Gemfile").exists():            markers.append("Ruby")
    if (root / "index.html").exists():         markers.append("Static web")
    if not markers:                            markers.append("generic")

    # ── Preview ───────────────────────────────────────────────────────────
    print()
    print(f"  {C.BOLD}Detected{C.RESET} {C.DIM}·{C.RESET} {', '.join(markers)}")
    print(f"  {C.BOLD}Source files found{C.RESET} "
          f"{C.DIM}·{C.RESET} {total_source} need headers"
          f"  {C.DIM}({header_stats.get('hash',0)} hash, "
          f"{header_stats.get('block',0)} block, "
          f"{header_stats.get('html',0)} html){C.RESET}")
    if skipped_binary:
        print(f"  {C.DIM}({skipped_binary} files skipped as binary/undecodable){C.RESET}")

    print()
    print(f"  {C.BOLD}Plan{C.RESET}")
    hr()
    print(f"  {C.GREEN}✚{C.RESET} LICENSE              "
          f"{C.DIM}Apache-2.0 · Copyright {year} {holder}{C.RESET}")
    if not args.no_notice:
        print(f"  {C.GREEN}✚{C.RESET} NOTICE               "
              f"{C.DIM}{project} attribution file{C.RESET}")

    if not args.no_config:
        for fname, fn, sec in [
            ("package.json",  update_package_json, None),
            ("composer.json", update_composer_json, None),
            ("pyproject.toml", _update_toml_license, "project"),
            ("Cargo.toml",     _update_toml_license, "package"),
        ]:
            p = root / fname
            if p.exists():
                print(f"  {C.CYAN}✎{C.RESET} {fname:<20} "
                      f"{C.DIM}set license = Apache-2.0{C.RESET}")

    if not args.no_headers and total_source:
        preview_n = min(total_source, 8)
        print(f"  {C.CYAN}✎{C.RESET} Adding header to {total_source} source file"
              f"{'s' if total_source != 1 else ''}:")
        for p, style, _ in to_header[:preview_n]:
            rel = p.relative_to(root)
            print(f"      {C.DIM}{rel}{C.RESET}")
        if total_source > preview_n:
            print(f"      {C.DIM}… and {total_source - preview_n} more{C.RESET}")

    if args.dry_run:
        print()
        print(f"  {C.YELLOW}--dry-run · nothing will be written.{C.RESET}")
        print()
        return

    # ── Confirm ───────────────────────────────────────────────────────────
    if interactive:
        print()
        if not prompt_yesno(f"{C.BOLD}Proceed?{C.RESET}", default=True):
            print(f"  {C.DIM}Aborted.{C.RESET}")
            return

    print()
    print(f"  {C.BOLD}Writing…{C.RESET}")
    hr()

    # ── 1. LICENSE ────────────────────────────────────────────────────────
    license_path = root / "LICENSE"
    license_text = render_license_file(holder, year)

    write_license = True
    if license_path.exists():
        try:
            existing = license_path.read_text(encoding="utf-8", errors="replace")
        except Exception:
            existing = ""
        if "Apache License" in existing and "Version 2.0" in existing:
            print(f"  {C.DIM}·{C.RESET} LICENSE already Apache 2.0 — updating year/holder")
        else:
            if interactive:
                if not prompt_yesno(
                    f"{C.YELLOW}LICENSE already exists ({len(existing)} bytes). "
                    f"Overwrite?{C.RESET}", default=False
                ):
                    write_license = False
                    print(f"  {C.DIM}·{C.RESET} LICENSE left untouched")
            else:
                write_license = False
                print(f"  {C.YELLOW}!{C.RESET} LICENSE exists — skipped (use interactive mode to overwrite)")

    if write_license:
        license_path.write_text(license_text, encoding="utf-8")
        print(f"  {C.GREEN}✓{C.RESET} LICENSE created "
              f"({len(license_text):,} bytes)")

    # ── 2. NOTICE ─────────────────────────────────────────────────────────
    if not args.no_notice:
        notice_path = root / "NOTICE"
        notice_text = render_notice_file(project, holder, year, email, website)
        if notice_path.exists():
            try:
                existing_n = notice_path.read_text(encoding="utf-8", errors="replace")
            except Exception:
                existing_n = ""
            if "Apache License" in existing_n:
                print(f"  {C.DIM}·{C.RESET} NOTICE already present — refreshing")
        notice_path.write_text(notice_text, encoding="utf-8")
        print(f"  {C.GREEN}✓{C.RESET} NOTICE  created")

    # ── 3. Config files ───────────────────────────────────────────────────
    if not args.no_config:
        for fname, fn, sec in [
            ("package.json",  update_package_json, None),
            ("composer.json", update_composer_json, None),
            ("pyproject.toml", _update_toml_license, "project"),
            ("Cargo.toml",     _update_toml_license, "package"),
        ]:
            p = root / fname
            if not p.exists():
                continue
            try:
                result = fn(p, sec) if sec else fn(p)
                print(f"  {C.GREEN}✓{C.RESET} {fname:<20} {C.DIM}{result}{C.RESET}")
            except Exception as e:
                print(f"  {C.RED}✗{C.RESET} {fname:<20} {e}")

    # ── 4. Source headers ─────────────────────────────────────────────────
    if not args.no_headers and to_header:
        header_body = build_header_body(holder, year)
        written = 0
        failed = 0
        for p, style, original in to_header:
            block = wrap_as_comment(header_body, style)
            try:
                new_text = insert_header(original, block)
                _, enc = read_text(p)
                write_text(p, new_text, enc)
                written += 1
            except Exception as e:
                failed += 1
                if failed <= 5:
                    rel = p.relative_to(root)
                    print(f"  {C.RED}✗{C.RESET} {rel}: {e}")
        if written:
            print(f"  {C.GREEN}✓{C.RESET} Added header to {written} source file"
                  f"{'s' if written != 1 else ''}")
        if failed:
            print(f"  {C.YELLOW}!{C.RESET} {failed} file{'s' if failed != 1 else ''} could not be written")

    # ── Done ──────────────────────────────────────────────────────────────
    print()
    print(f"  {C.BOLD}{C.GREEN}Done.{C.RESET} "
          f"{project} is now licensed under Apache-2.0.")
    print(f"  {C.DIM}Copyright {year} {holder}{C.RESET}")
    print()
    print(f"  {C.DIM}Next steps:{C.RESET}")
    print(f"  {C.DIM}  · Commit LICENSE, NOTICE and any modified source files{C.RESET}")
    print(f"  {C.DIM}  · Mention the license in your README:{C.RESET}")
    print(f"  {C.DIM}      [![License](https://img.shields.io/badge/License-Apache_2.0-blue.svg)]"
          f"(https://opensource.org/licenses/Apache-2.0){C.RESET}")
    print()


if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        print(f"\n{C.DIM}Interrupted.{C.RESET}")
        sys.exit(130)
