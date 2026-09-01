#!/usr/bin/env bash
set -euo pipefail

repo_root=$(git rev-parse --show-toplevel 2>/dev/null) || {
  echo 'Run from inside the OpenFlow Git worktree.' >&2
  exit 1
}
host=${OPENFLOW_WINDOWS_HOST:-edy-main}
remote_root=${OPENFLOW_WINDOWS_REMOTE_ROOT:-/d/OpenFlow/Validation}
mode=Dev
if [[ ${1:-} == --candidate ]]; then mode=Candidate; shift; fi
if [[ $# -ne 0 ]]; then
  echo 'Usage: npm run verify:windows:remote OR npm run verify:windows:candidate' >&2
  exit 1
fi
if [[ $host != edy-main ]]; then
  echo "Refusing non-fixed Windows host: $host" >&2
  exit 1
fi
if [[ $remote_root != /d/OpenFlow/Validation ]]; then
  echo "Refusing unsafe Windows validation root: $remote_root" >&2
  exit 1
fi
if [[ -n $(git -C "$repo_root" diff --name-only --diff-filter=U) ]]; then
  echo 'Refusing to snapshot unresolved Git conflicts.' >&2
  exit 1
fi

base_commit=$(git -C "$repo_root" rev-parse HEAD)
source_dirty=false
if [[ -n $(git -C "$repo_root" status --porcelain --untracked-files=normal) ]]; then source_dirty=true; fi
scratch=$(mktemp -d "${TMPDIR:-/tmp}/openflow-windows.XXXXXX")
remote_log="$scratch/windows.log"
cleanup() { rm -rf "$scratch"; }
trap cleanup EXIT

token="$(date -u +%Y%m%dT%H%M%SZ)-${base_commit:0:12}-$RANDOM"
bundle="$scratch/source.bundle"
patch="$scratch/working-tree.patch"
untracked_list="$scratch/untracked-files"
untracked_archive="$scratch/untracked-files.tar.gz"

git -C "$repo_root" bundle create "$bundle" HEAD
git -C "$repo_root" diff --binary --full-index HEAD -- . >"$patch"
git -C "$repo_root" ls-files --others --exclude-standard -z >"$untracked_list"
while IFS= read -r -d '' path; do
  if [[ $path == /* || $path == ../* || $path == *'/../'* ]]; then
    echo "Unsafe untracked path: $path" >&2
    exit 1
  fi
done <"$untracked_list"
if [[ -s $untracked_list ]]; then
  COPYFILE_DISABLE=1 tar --format ustar --no-xattrs -C "$repo_root" --null -czf "$untracked_archive" -T "$untracked_list"
else
  COPYFILE_DISABLE=1 tar --format ustar --no-xattrs -czf "$untracked_archive" --files-from /dev/null
fi

bundle_sha=$(shasum -a 256 "$bundle" | awk '{print $1}')
patch_sha=$(shasum -a 256 "$patch" | awk '{print $1}')
untracked_sha=$(shasum -a 256 "$untracked_archive" | awk '{print $1}')
snapshot_sha=$(printf '%s\n%s\n%s\n%s\n' "$base_commit" "$bundle_sha" "$patch_sha" "$untracked_sha" | shasum -a 256 | awk '{print $1}')

echo "OPENFLOW_SOURCE=Mac working tree"
echo "OPENFLOW_MAC_COMMIT=$base_commit"
echo "OPENFLOW_SOURCE_DIRTY=$source_dirty"
echo "OPENFLOW_SNAPSHOT_SHA256=$snapshot_sha"
echo "OPENFLOW_WINDOWS_MODE=$mode"

ssh -o BatchMode=yes -o ConnectTimeout=10 "$host" \
  "mkdir -p '$remote_root/incoming' && test ! -e '$remote_root/incoming/$token.source.bundle'"
ssh -o BatchMode=yes "$host" "cat > '$remote_root/incoming/$token.source.bundle'" <"$bundle"
ssh -o BatchMode=yes "$host" "cat > '$remote_root/incoming/$token.working-tree.patch'" <"$patch"
ssh -o BatchMode=yes "$host" "cat > '$remote_root/incoming/$token.untracked-files.tar.gz'" <"$untracked_archive"

set +e
ssh -o BatchMode=yes "$host" bash -s -- \
  "$remote_root" "$token" "$base_commit" "$snapshot_sha" "$source_dirty" "$mode" \
  "$bundle_sha" "$patch_sha" "$untracked_sha" \
  <"$repo_root/scripts/windows-remote-runner.sh" | tee "$remote_log"
status=${PIPESTATUS[0]}
set -e

echo
echo "WINDOWS VERIFY: $([[ $status -eq 0 ]] && echo PASS || echo FAIL)"
echo 'SOURCE: Mac working tree'
echo "MAC COMMIT: $base_commit"
echo "DIRTY CHANGES: $([[ $source_dirty == true ]] && echo YES || echo NO)"
echo "SNAPSHOT SHA-256: $snapshot_sha"
echo "WINDOWS MODE: $mode"
echo "WINDOWS TESTS: $([[ $status -eq 0 ]] && echo PASS || echo FAIL)"
if [[ $mode == Dev ]]; then
  echo "DEV BUILD: $([[ $status -eq 0 ]] && echo PASS || echo FAIL)"
  echo "DEV INSTALL: $([[ $status -eq 0 ]] && echo PASS || echo FAIL)"
  grep -E '"DevTarget"|"DevBatch"' "$remote_log" | tail -2 || true
else
  echo "CANDIDATE BUILD: $([[ $status -eq 0 ]] && echo PASS || echo FAIL)"
  echo "CANDIDATE ACCEPTANCE: $([[ $status -eq 0 ]] && echo PASS || echo FAIL)"
fi
echo 'STABLE TOUCHED: NO'
echo 'COMMIT/PUSH/TAG/RELEASE: NO/NO/NO/NO'
exit "$status"
