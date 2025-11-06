#!/usr/bin/env sh
# Build and optionally push the OpenRemote Manager Docker image
#
# Usage:
#   tools/build-manager-image.sh [TAG]
#
# Environment variables:
#   REPOSITORY   Repository/name for the image (default: openremote/manager)
#   PUSH         If set to "true", will push the built image to the registry
#
# Examples:
#   tools/build-manager-image.sh 1.0.0
#   REPOSITORY=ghcr.io/your-org/openremote-manager tools/build-manager-image.sh fa-local
#   REPOSITORY=ghcr.io/your-org/openremote-manager PUSH=true tools/build-manager-image.sh 1.0.0
set -eu

SCRIPT_DIR="$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)"
REPO_ROOT="$(dirname "$SCRIPT_DIR")"

TAG="${1:-local}"
REPO="${REPOSITORY:-openremote/manager}"
PUSH_FLAG="${PUSH:-}" # empty or "true"

printf "[INFO] Building Manager distribution and UI artifacts...\n"
cd "$REPO_ROOT"
./gradlew :manager:installDist :ui:app:shared:installDist :ui:app:manager:installDist :ui:app:console_loader:installDist --no-daemon

DIST_DIR="${REPO_ROOT}/manager/build/install/manager"
if [ ! -d "$DIST_DIR" ]; then
  echo "[ERROR] Distribution directory not found: $DIST_DIR" >&2
  exit 1
fi

# Ensure deployment folder is available in Docker build context
if [ -d "${REPO_ROOT}/deployment" ]; then
  printf "[INFO] Staging deployment directory into build context...\n"
  rm -rf "${DIST_DIR}/deployment"
  cp -R "${REPO_ROOT}/deployment" "${DIST_DIR}/deployment"
else
  echo "[WARN] Repository deployment directory not found at ${REPO_ROOT}/deployment; proceeding without it."
fi

# Determine git commit for label (best effort)
GIT_COMMIT="unknown"
if command -v git >/dev/null 2>&1; then
  if git -C "$REPO_ROOT" rev-parse --short HEAD >/dev/null 2>&1; then
    GIT_COMMIT="$(git -C "$REPO_ROOT" rev-parse --short HEAD)"
  fi
fi

printf "[INFO] Building Docker image %s:%s from %s\n" "$REPO" "$TAG" "$DIST_DIR"
cd "$DIST_DIR"

docker build --platform linux/amd64 \
  --build-arg "GIT_COMMIT=${GIT_COMMIT}" \
  -t "${REPO}:${TAG}" \
  -f Dockerfile \
  .

printf "[INFO] Built image %s:%s\n" "$REPO" "$TAG"

if [ "${PUSH_FLAG}" = "true" ]; then
  printf "[INFO] Pushing image %s:%s\n" "$REPO" "$TAG"
  docker push "${REPO}:${TAG}"
fi

printf "[INFO] Done.\n"
