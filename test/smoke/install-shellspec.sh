#!/bin/sh
# shellcheck disable=SC2034
# MIT License
#
# Copyright (c) 2018 Koichi Nakashima
#
# Permission is hereby granted, free of charge, to any person obtaining a copy
# of this software and associated documentation files (the "Software"), to deal
# in the Software without restriction, including without limitation the rights
# to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
# copies of the Software, and to permit persons to whom the Software is
# furnished to do so, subject to the following conditions:
#
# The above copyright notice and this permission notice shall be included in all
# copies or substantial portions of the Software.
#
# THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
# IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
# FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
# AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
# LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
# OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
# SOFTWARE.

test || __() { :; }

installer="https://github.com/shellspec/shellspec/blob/22a80af088c939e03599821b7e9721b51cb1bd82/install.sh"
repo="https://github.com/shellspec/shellspec.git"
archive="https://github.com/shellspec/shellspec/archive"
project="shellspec"
exec="shellspec"

set -eu && :<<'USAGE'
Usage: [sudo] ${0##*/} [VERSION] [OPTIONS...]
  or : wget -O- $installer | [sudo] sh
  or : wget -O- $installer | [sudo] sh -s -- [OPTIONS...]
  or : wget -O- $installer | [sudo] sh -s VERSION [OPTIONS...]
  or : curl -fsSL $installer | [sudo] sh
  or : curl -fsSL $installer | [sudo] sh -s -- [OPTIONS...]
  or : curl -fsSL $installer | [sudo] sh -s VERSION [OPTIONS...]

VERSION:
  Specify install version and method

  e.g
    1.0.0           Install 1.0.0 from git
    master          Install master from git
    1.0.0.tar.gz    Install 1.0.0 from tar.gz archive
    .               Install from local directory

OPTIONS:
  -p, --prefix PREFIX   Specify prefix                 [default: \$HOME/.local]
  -b, --bin BIN         Specify bin directory          [default: <PREFIX>/bin]
  -d, --dir DIR         Specify installation directory [default: <PREFIX>/lib/$project]
  -s, --switch          Switch version (requires installation via git)
  -l, --list            List available versions (tags)
      --pre             Include pre-release
      --fetch FETCH     Force command to use when installing from archive (curl or wget)
  -y, --yes             Automatic yes to prompts
  -h, --help            You're looking at it
USAGE

usage() {
  while IFS= read -r line && [ ! "${line#*:}" = \<\<"'$1'" ]; do :; done
  while IFS= read -r line && [ ! "$line" = "$1" ]; do set "$@" "$line"; done
  shift && [ $# -eq 0 ] || printf '%s\n' cat\<\<"$line" "$@" "$line"
}

CDPATH=''
[ "${ZSH_VERSION:-}" ] && setopt shwordsplit

finish() { done=1; exit "${1:-0}"; }
error() { printf '\033[31m%s\033[0m\n' "$1"; }
abort() { [ "${1:-}" ] && error "$1" >&2; finish 1; }
finished() { [ "$done" ] || error "Failed to install"; }

exists() {
  type "$1" >/dev/null 2>&1 && return 0
  ( IFS=:; for p in $PATH; do [ -x "${p%/}/$1" ] && return 0; done; return 1 )
}

prompt() {
  set -- "$1" "$2" "${3:-/dev/tty}"
  printf "%s " "$1"
  if eval "[ \"\$$2\" ] && :"; then
    eval "printf \"%s\n\" \"\$$2\""
  else
    IFS= read -r "$2" < "$3" || return 1
    [ "$3" = "/dev/tty" ] || eval "printf \"%s\n\" \"\$$2\""
  fi
}

is_yes() {
  case $1 in ( [Yy] | [Yy][Ee][Ss] ) return 0; esac
  return 1
}

confirm() {
  prompt "$@" || return 1
  eval "is_yes \"\$$2\" &&:"
}

fetch() {
  tmpfile="${TMPDIR:-${TMP:-/tmp}}/${1##*/}.$$"
  case $FETCH in
    curl) curl --head -sSfL -o /dev/null "$1" && curl -SfL "$1" ;;
    wget) wget --spider -q "$1" && wget -O- "$1" ;;
  esac > "$tmpfile" &&:
  error=$?
  if [ "$error" -eq 0 ]; then
    unarchive "$tmpfile" "$1" "$2" &&:
    error=$?
    [ "$error" -ne 0 ] && [ -d "$2" ] && rm -rf "$2"
  fi
  rm "$tmpfile"
  return "$error"
}

unarchive() {
  mkdir -p "${3%/*}"
  gunzip -c "$1" | (cd "${3%/*}"; tar xf -)
  set -- "$1" "${2##*/}" "$3"
  mv "$(components_path "${3%/*}/$project-${2%.tar.gz}"*)" "$3"
}

components_path() {
  ( set +u
    cd "${1%/*}"
    for p in *; do
      case $p in (${1##*/}*) echo "${1%/*}/$p"; break ; esac
    done
  )
}

git_remote_tags() {
  git ls-remote --tags "$repo" | while read -r line; do
    tag=${line##*/} && pre=${tag#${tag%%[-+]*}}
    [ "${1:-}" = "--pre" ] || case $pre in (-*) continue; esac
    echo "${tag%\^\{\}}"
  done | uniq
}

get_versions() {
  git_remote_tags "${PRE:+--pre}"
}

sort_by_first_key() {
  # Retry if sort is Windows version
  ( export LC_ALL=C; sort -k 1 2>/dev/null || command -p sort -k 1 )
}

version_sort() {
  while read -r version; do
    ver=${version%%+*} && num=${ver%%-*} && pre=${ver#$num}
    #shellcheck disable=SC2086
    case $num in
      *[!0-9.]*)  set -- 0 0 0 0 ;;
      *) IFS=. && set -- $num ;;
    esac
    printf '%08d%08d%08d%08d' "${1:-0}" "${2:-0}" "${3:-0}" "${4:-0}"
    printf '%s %s\n' "${pre:-=}" "$version"
  done | sort_by_first_key | while read -r kv; do echo "${kv#* }"; done
}

join() {
  s=''
  while read -r v; do
    s="$s$v$1"
  done
  echo "${s%"$1"}"
}

last() {
  version=''
  while read -r v; do
    version=$v
  done
  echo "$version"
}

list_versions() {
  get_versions | version_sort | join ", "
}

latest_version() {
  get_versions | version_sort | last
}

${__SOURCED__:+false} : || return 0

trap finished EXIT
VERSION='' PREFIX=$HOME/.local BIN='' DIR='' SWITCH='' PRE='' YES='' FETCH=''
done='' mode=install

__ parse_option __

while [ $# -gt 0 ]; do
  case $1 in
    -p | --prefix ) [ "${2:-}" ] || abort "PREFIX not specified"
                    PREFIX=$2 && shift ;;
    -b | --bin    ) [ "${2:-}" ] || abort "BIN not specified"
                    BIN=$2 && shift ;;
    -d | --dir    ) [ "${2:-}" ] || abort "DIR not specified"
                    DIR=$2 && shift ;;
    -s | --switch ) SWITCH=1 ;;
    -y | --yes    ) YES=y ;;
    -l | --list   ) mode=list ;;
         --pre    ) PRE=1 ;;
         --fetch  ) [ "${2:-}" ] || abort "FETCH not specified"
                    case $2 in ( curl | wget ) FETCH=$2 && shift ;;
                      *) abort "FETCH must be 'curl' or 'wget'."
                    esac ;;
    -h | --help   ) eval "$(usage "USAGE" < "$0")" && finish ;;
    -*            ) abort "Unknown option $1" ;;
    *             ) VERSION=$1 ;;
  esac
  shift
done

if [ "$mode" = "list" ]; then
  list_versions
  finish
fi

BIN=${BIN:-${PREFIX%/}/bin} DIR=${DIR:-${PREFIX%/}/lib/$project}

__ main __

case $VERSION in
  .)
    method=local DIR=$PWD
    [ -x "$DIR/$exec" ] || abort "Not found '$exec' in installation directory: '$DIR'"
    VERSION=$("$DIR/$exec" --version)
    ;;
  *.tar.gz)
    [ "$SWITCH" ] && abort "Can not switch version when install from archive"
    [ -e "$DIR" ] && abort "Already exists installation directory: '$DIR'"
    method=archive
    [ ! "$FETCH" ] && exists curl && FETCH=curl
    [ ! "$FETCH" ] && exists wget && FETCH=wget
    [ "$FETCH" ] || abort "Requires 'curl' or 'wget' when install from archive"
    exists tar || abort "Not found 'tar' when install from archive"
    ;;
  *)
    if [ "$SWITCH" ]; then
      method=switch
      [ -d "$DIR" ] || abort "Not found installation directory: '$DIR'"
      [ -d "$DIR/.git" ] || abort "Can't switch it's not a git repository: '$DIR'"
    else
      method=git
      [ -e "$DIR" ] && abort "Already exists installation directory: '$DIR'"
    fi
    # requires git >= 1.7.10.4
    exists git || abort "Requires 'git' when install from git repository"
    [ "$VERSION" ] || VERSION=$(latest_version)
esac

echo "Executable file        : $BIN/$exec"
echo "Installation directory : $DIR"
echo "Version (tag or commit): $VERSION"
case $method in
  git) echo "[git] $repo" ;;
  archive) echo "[$FETCH] $archive/$VERSION" ;;
esac
echo

confirm "Do you want to continue? [y/N]" YES || abort "Canceled"

case $method in
  git)
    git init "$DIR" && cd "$DIR"
    git remote add origin "$repo"
    git fetch --depth=1 origin "$VERSION"
    git checkout -b "$VERSION" FETCH_HEAD
    ;;
  archive)
    fetch "$archive/$VERSION" "$DIR"
    ;;
  switch)
    cd "$DIR"
    if message=$(git checkout "$VERSION" 2>&1); then
      echo "$message"
    else
      git fetch --depth=1 origin "$VERSION"
      git checkout -b "$VERSION" FETCH_HEAD
    fi
    ;;
  local) # Do nothing
esac

mkdir -p "$BIN"
ln -sf "$DIR/$exec" "$BIN/$exec"

if [ ! -L "$BIN/$exec" ]; then
  rm "$BIN/$exec"
  printf '#!/bin/sh\nexec "%s" "$@"\n' "$DIR/$exec" > "$BIN/$exec"
  chmod +x "$BIN/$exec"
fi

echo "Done"
finish
