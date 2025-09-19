export const REPO_CONFIG = {
    votingSystemFrontend: {
      path: "/var/www/voting-frontend",
      branch: "main",
      deploy_cmd: "git pull origin main && pnpm install && pnpm build"
    },
    votingBackend: {
      path: "/var/www/voting-backend",
      branch: "main",
      deploy_cmd: "git restore . && git clean -fd && git pull origin main && . venv/bin/activate && pip install -r requirements.txt && python manage.py migrate && python manage.py collectstatic --noinput && sudo systemctl restart voting-backend"
    }
  };