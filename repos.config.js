export const REPO_CONFIG = {
  backend: {
    path: "/var/www/backend",
    branch: "main",
    deploy_cmd: "bash -c 'source env/bin/activate && git pull origin main && pip install -r requirements.txt && python manage.py migrate && python manage.py collectstatic --noinput && pm2 restart backend'"
  },
  sharptoolz: {
    path: "/var/www/sharptoolz",
    branch: "main",
    deploy_cmd: "git pull origin main && pnpm install && pnpm build"
  },
  shippingTracker: {
    path: "/var/www/shippingTracker",
    branch: "main",
    deploy_cmd: "git pull origin main && pnpm install && pnpm build"
  },

  flightTracker: {
    path: "/var/www/flightTracker",
    branch: "main",
    deploy_cmd: "git pull origin main && pnpm install && pnpm build"
  }
};
