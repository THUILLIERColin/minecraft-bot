#!/usr/bin/env bash
# Déploie le bot sur la machine qui héberge le serveur Minecraft : met à jour
# le dépôt, reconstruit l'image et remplace le conteneur en place.
set -euo pipefail

readonly NAME=mc-monitor
readonly CONTAINER_LOG_DIR=/logs

fail() {
  echo "Erreur : $1" >&2
  exit 1
}

# Lit une variable de .env sans l'exécuter : `source .env` interpréterait son
# contenu comme du bash (une valeur contenant `$(...)` serait exécutée).
read_env_var() {
  grep -E "^$1=" .env | tail -n 1 | cut -d= -f2- || true
}

# Tout le script vit dans main, appelée en dernière ligne : bash lit ainsi la
# fonction entière avant de l'exécuter, et le `git pull` ci-dessous peut
# réécrire ce fichier sans corrompre l'exécution en cours.
main() {
  cd "$(dirname "$0")/.."

  # Vérifications AVANT de toucher au conteneur en place : si l'une échoue,
  # l'ancien bot continue de tourner.
  [[ -f .env ]] || fail ".env introuvable dans $(pwd)"

  local run_args=(
    -d
    --restart unless-stopped
    --network host
    --env-file .env
    --log-opt max-size=10m
    --log-opt max-file=3
    --name "$NAME"
  )

  local host_log_dir
  host_log_dir=$(read_env_var HOST_LOG_DIR)
  if [[ -n "$host_log_dir" ]]; then
    # Sans ce test, Docker créerait silencieusement un dossier vide à la place.
    [[ -d "$host_log_dir" ]] || fail "HOST_LOG_DIR=$host_log_dir introuvable"
    # Le script choisit le point de montage, c'est donc lui qui indique au bot
    # où lire : -e l'emporte sur une éventuelle valeur de --env-file.
    run_args+=(
      -v "$host_log_dir:$CONTAINER_LOG_DIR:ro"
      -e "MC_LOG_PATH=$CONTAINER_LOG_DIR/latest.log"
    )
  fi

  git pull --ff-only

  docker build -t "$NAME" .
  docker image prune -f

  docker rm -f "$NAME" 2>/dev/null || true

  docker run "${run_args[@]}" "$NAME"

  docker logs -f --tail 20 "$NAME"
}

main "$@"
