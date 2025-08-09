# Northflank Deployment

This project is ready to deploy on [Northflank](https://northflank.com/).

## Requirements
- Node.js 20 (handled by Dockerfile)
- The app listens on the port specified by the `PORT` environment variable (default: 3000)
- Dockerfile exposes port 3000

## Deploy Steps
1. Push this repository to your Git provider (GitHub, GitLab, etc.).
2. Create a new service on Northflank:
   - Choose **Create service** > **Deployment** > **Dockerfile**.
   - Connect your repository.
   - Northflank will detect the Dockerfile automatically.
3. Set the **PORT** environment variable to `3000` (optional, as the app defaults to 3000 if not set).
4. Deploy the service.

## Notes
- The app will automatically use the port provided by Northflank via the `PORT` environment variable.
- If you need to change the port, update the `PORT` variable in your Northflank service settings.