# EC2 staging — https://staging.bld.online

- `/api/*` → Docker API `:4000`
- `/` → Cloudflare Worker (set hostname in `nginx-staging.conf`)

```bash
cd ~/BLD/stage
docker compose up -d
# edit nginx REPLACE_ME → your *.workers.dev host, then:
sudo nginx -t && sudo systemctl reload nginx
curl -sS https://staging.bld.online/api/health
curl -sSI https://staging.bld.online/
```
