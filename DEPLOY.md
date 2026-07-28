# Deploy do CineLock numa VPS

Guia do zero até o site no ar, com HTTPS, usando Docker. Feito pra quem nunca
fez deploy. A stack de produção vive no [`docker-compose.prod.yml`](./docker-compose.prod.yml).

## Como fica no ar

| Endereço | O que é |
| --- | --- |
| `https://cinelock.dev` | Front (site) |
| `https://api.cinelock.dev` | API + WebSocket |

Postgres, Redis e Kafka **não** ficam expostos na internet — só o Caddy (o
"porteiro") escuta as portas 80/443 e reencaminha pra API ou pro front.

---

## Pré-requisitos

- Uma VPS Ubuntu 24.04 (recomendado 2 GB de RAM). Com o crédito do GitHub
  Student na DigitalOcean, um Droplet de 2 GB sai de graça por meses.
- O domínio `cinelock.dev` (registrado no Name.com pelo GitHub Student Pack).

---

## Passo 1 — Criar o Droplet na DigitalOcean

1. Ative o crédito do GitHub Student Pack na DigitalOcean.
2. **Create → Droplets**. Escolha:
   - Região: a mais perto (ex.: New York ou São Paulo, se houver).
   - Imagem: **Ubuntu 24.04 LTS**.
   - Plano: **Basic → Regular → 2 GB / 1 vCPU**.
   - Autenticação: **SSH Key** (mais seguro que senha; a DO explica como colar
     sua chave pública). Se não tiver chave, gere com `ssh-keygen` na sua máquina.
3. Crie e anote o **IP público** do Droplet (ex.: `203.0.113.10`).

---

## Passo 2 — Firewall na borda (DigitalOcean Cloud Firewall)

Isso bloqueia o acesso externo a tudo que não seja SSH/HTTP/HTTPS — camada extra
de segurança na frente do Droplet.

1. No painel: **Networking → Firewalls → Create Firewall**.
2. **Inbound Rules** — deixe só:
   - SSH — TCP 22
   - HTTP — TCP 80
   - HTTPS — TCP 443
3. Em **Apply to Droplets**, selecione seu Droplet.

Assim, mesmo que algo publique a porta do Postgres por engano, a internet não
alcança.

---

## Passo 3 — Apontar o DNS (Name.com)

No painel do Name.com: **My Domains → cinelock.dev → DNS Records**.
Adicione dois registros apontando pro IP do Droplet:

| Type | Host | Answer / Value |
| --- | --- | --- |
| A | `@` | IP do Droplet |
| A | `api` | IP do Droplet |

O `@` representa a raiz (`cinelock.dev`); `api` vira `api.cinelock.dev`. DNS pode
levar de minutos a algumas horas pra propagar. Teste com:
`ping cinelock.dev` (tem que responder o IP do Droplet).

---

## Passo 4 — Conectar na VPS e instalar o Docker

Do seu computador:

```bash
ssh root@IP-DO-DROPLET
```

Já dentro da VPS, instale o Docker (script oficial):

```bash
curl -fsSL https://get.docker.com | sh
```

Confira: `docker --version` e `docker compose version`.

### Swap (rede de segurança de memória)

Numa VPS de 2 GB, o build do front pode dar pico de memória. Um swap de 2 GB
evita que o build morra por falta de RAM:

```bash
fallocate -l 2G /swapfile
chmod 600 /swapfile
mkswap /swapfile
swapon /swapfile
echo '/swapfile none swap sw 0 0' >> /etc/fstab
```

---

## Passo 5 — Trazer o código pra VPS

```bash
git clone https://github.com/SEU_USUARIO/cinelock.git
cd cinelock
```

(Troque pela URL real do seu repositório.)

---

## Passo 6 — Configurar os segredos

```bash
cp .env.prod.example .env
nano .env
```

Preencha:

- `POSTGRES_PASSWORD` — uma senha forte. Gere uma com:
  ```bash
  openssl rand -hex 24
  ```
- `VITE_API_URL` — deixe `https://api.cinelock.dev`.

Salve (`Ctrl+O`, Enter) e saia (`Ctrl+X`). O `.env` fica só na VPS e nunca vai
pro Git.

---

## Passo 7 — Subir tudo

```bash
docker compose -f docker-compose.prod.yml up -d --build
```

- `--build` compila as imagens da API e do front (primeira vez demora alguns minutos).
- `-d` roda em segundo plano.

O `migrate` aplica as migrations do banco antes de a API subir. O Caddy vai
pegar o certificado HTTPS automaticamente no primeiro acesso (precisa do DNS do
Passo 3 já propagado).

### Popular o catálogo (uma vez só)

```bash
docker compose -f docker-compose.prod.yml --profile seed run --rm seed
```

---

## Passo 8 — Conferir

- Abra `https://cinelock.dev` no navegador (com cadeadinho).
- A API responde em `https://api.cinelock.dev`.

Ver o estado dos containers e logs:

```bash
docker compose -f docker-compose.prod.yml ps
docker compose -f docker-compose.prod.yml logs -f          # todos
docker compose -f docker-compose.prod.yml logs -f caddy    # só o Caddy (útil se o HTTPS falhar)
```

---

## Operação do dia a dia

**Atualizar depois de mudar o código** (fez push no GitHub):

```bash
cd cinelock
git pull
docker compose -f docker-compose.prod.yml up -d --build
```

**Reiniciar / parar:**

```bash
docker compose -f docker-compose.prod.yml restart
docker compose -f docker-compose.prod.yml down          # para tudo (mantém os dados)
docker compose -f docker-compose.prod.yml down -v       # para E APAGA os dados (cuidado!)
```

---

## Se algo der errado

- **HTTPS não sobe / "certificate error":** quase sempre é DNS. Confirme que
  `cinelock.dev` e `api.cinelock.dev` já apontam pro IP
  (`ping`). O Let's Encrypt precisa alcançar o Droplet pela porta 80.
- **Build morre / "killed":** faltou memória. Confirme que o swap do Passo 4
  está ativo (`free -h` deve mostrar swap).
- **Front abre mas não fala com a API:** o `VITE_API_URL` no `.env` precisa estar
  certo **antes** do `--build` (ele é embutido no JS na hora de compilar). Se
  mudou, rode `up -d --build` de novo.
- **Ver o que o Caddy está fazendo:** `docker compose -f docker-compose.prod.yml logs -f caddy`.
