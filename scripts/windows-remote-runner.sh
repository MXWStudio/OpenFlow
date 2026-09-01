#!/usr/bin/env bash
set -euo pipefail

remote_root=${1:-}
token=${2:-}
base_commit=${3:-}
snapshot_sha=${4:-}
source_dirty=${5:-}
mode=${6:-}
bundle_sha=${7:-}
patch_sha=${8:-}
untracked_sha=${9:-}

[[ $remote_root == /d/OpenFlow/Validation ]] || { echo 'Unsafe remote root.' >&2; exit 1; }
[[ $token =~ ^[0-9]{8}T[0-9]{6}Z-[0-9a-f]{12}-[0-9]+$ ]] || { echo 'Invalid token.' >&2; exit 1; }
[[ $base_commit =~ ^[0-9a-f]{40}$ ]] || { echo 'Invalid commit.' >&2; exit 1; }
[[ $snapshot_sha =~ ^[0-9a-f]{64}$ ]] || { echo 'Invalid snapshot SHA-256.' >&2; exit 1; }
[[ $source_dirty == true || $source_dirty == false ]] || { echo 'Invalid dirty flag.' >&2; exit 1; }
[[ $mode == Dev || $mode == Candidate ]] || { echo 'Invalid mode.' >&2; exit 1; }

incoming="$remote_root/incoming"
bundle="$incoming/$token.source.bundle"
patch="$incoming/$token.working-tree.patch"
untracked_archive="$incoming/$token.untracked-files.tar.gz"
run_root="$remote_root/runs/$token"
source_root="$run_root/source"
evidence_root="$run_root/evidence"
for file in "$bundle" "$patch" "$untracked_archive"; do [[ -f $file ]] || { echo "Missing input: $file" >&2; exit 1; }; done
[[ $(sha256sum "$bundle" | awk '{print $1}') == $bundle_sha ]] || { echo 'Bundle hash mismatch.' >&2; exit 1; }
[[ $(sha256sum "$patch" | awk '{print $1}') == $patch_sha ]] || { echo 'Patch hash mismatch.' >&2; exit 1; }
[[ $(sha256sum "$untracked_archive" | awk '{print $1}') == $untracked_sha ]] || { echo 'Untracked archive hash mismatch.' >&2; exit 1; }
[[ ! -e $run_root ]] || { echo 'Run root already exists.' >&2; exit 1; }

mkdir -p "$evidence_root"
git clone --quiet "$bundle" "$source_root"
git -C "$source_root" checkout --quiet --detach "$base_commit"
if [[ -s $patch ]]; then git -C "$source_root" apply --whitespace=nowarn "$patch"; fi
tar -xzf "$untracked_archive" -C "$source_root"
[[ $(git -C "$source_root" rev-parse HEAD) == $base_commit ]] || { echo 'Restored commit mismatch.' >&2; exit 1; }

repo_windows=$(cygpath -w "$source_root")
evidence_windows=$(cygpath -w "$evidence_root")
validator_windows=$(cygpath -w "$source_root/scripts/windows-electron-validate.ps1")
set +e
powershell.exe -NoProfile -NonInteractive -ExecutionPolicy Bypass -File "$validator_windows" \
  -Mode "$mode" -RepoRoot "$repo_windows" -SourceCommit "$base_commit" \
  -SnapshotSha256 "$snapshot_sha" -SourceDirtyText "$source_dirty" -EvidenceRoot "$evidence_windows" \
  2>&1 | tee "$run_root/validation.log"
status=${PIPESTATUS[0]}
set -e
rm -f "$bundle" "$patch" "$untracked_archive"
if [[ $status -ne 0 ]]; then
  echo "OPENFLOW_WINDOWS_RESULT=FAIL"
  echo "OPENFLOW_REMOTE_EVIDENCE=$(cygpath -w "$run_root")"
  exit "$status"
fi
echo "OPENFLOW_WINDOWS_RESULT=PASS"
echo "OPENFLOW_REMOTE_EVIDENCE=$(cygpath -w "$run_root")"
