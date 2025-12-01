export const REPO_CONFIG = {
  tajma: {
    path: "/var/www/Tajma",
    branch: "main",
    deploy_cmd: "bash -c 'source /home/devuser/.bashrc && export PATH=\"$HOME/.local/bin:$PATH\" && export ENV=production && git pull origin main && cd frontend && pnpm install && pnpm build && cd ../backend && poetry install --no-root && poetry run python manage.py migrate && pm2 restart tajma tajma-backend'"
  },
  nigercanton: {
    path: "/var/www/NigerCanton",
    branch: "master",
    deploy_cmd: "bash -c 'source /home/devuser/.bashrc && export PATH=\"$HOME/.local/bin:$PATH\" && export DB_PORT=5432 && export ENV=production && git pull origin master && cd frontend && pnpm install && pnpm build && cd ../backend && poetry install && poetry run python manage.py migrate && poetry run python manage.py collectstatic --noinput && pm2 restart nigercanton-frontend nigercanton-backend'"
  }
};