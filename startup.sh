set -e

echo "Starting backend..."
cd /home/site/wwwroot/backend
node server.js &

echo "Starting frontend..."
cd /home/site/wwwroot/frontend/my-app
npm start