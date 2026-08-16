[repositories/logmas-backend (22)] [getfjupm@premium291 logmas-backend]$ git pull
remote: Invalid username or token. Password authentication is not supported for Git operations.
fatal: Authentication failed for 'https://github.com/MigrationGFA/logmas-backend.git/'
[repositories/logmas-backend (22)] [getfjupm@premium291 logmas-backend]$ git fetch origin
remote: Invalid username or token. Password authentication is not supported for Git operations.
fatal: Authentication failed for 'https://github.com/MigrationGFA/logmas-backend.git/'
[repositories/logmas-backend (22)] [getfjupm@premium291 logmas-backend]$ ^C
[repositories/logmas-backend (22)] [getfjupm@premium291 logmas-backend]$ git remote set-url origin https://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@github.com/MigrationGFA/logmas-backend.git
[repositories/logmas-backend (22)] [getfjupm@premium291 logmas-backend]$ git fetch originremote: Enumerating objects: 12, done.
remote: Counting objects: 100% (12/12), done.
remote: Compressing objects: 100% (1/1), done.
remote: Total 7 (delta 6), reused 7 (delta 6), pack-reused 0 (from 0)
Unpacking objects: 100% (7/7), 1.87 KiB | 382.00 KiB/s, done.
From https://github.com/MigrationGFA/logmas-backend
   00870fe..b68e336  main       -> origin/main
[repositories/logmas-backend (22)] [getfjupm@premium291 logmas-backend]$


dont forget to get token from developer settings fine token grain

# 1. Install any new dependencies you might have added locally
npm install

# 2. Sync your database schema and refresh the Prisma client types
npx prisma db push
npx prisma generate

# 3. Compile your TypeScript code into production-ready JavaScript
npm run build

# 4. Kill the stale processes so Passenger boots up using the fresh build folder
pkill -u getfjupm node


npx prisma db push

npx prisma migrate dev --name added_more


# seed plan for revenue category if need be
hard code the categories using npx prisma db seed
make sure the seed file is properly typed