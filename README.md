# Meu Painel ✦

Painel pessoal com finanças (Pluggy Open Finance), tracker de estudos, projetos artísticos e agenda.

---

## 🚀 Deploy no Vercel (passo a passo)

### 1. Configurar variáveis de ambiente no Vercel

Antes de fazer o deploy, adicione as variáveis no painel do Vercel:

| Nome | Valor |
|------|-------|
| `VITE_PLUGGY_CLIENT_ID` | seu client_id da Pluggy |
| `VITE_PLUGGY_CLIENT_SECRET` | seu client_secret da Pluggy |

### 2. Subir no GitHub

```bash
git init
git add .
git commit -m "primeiro commit ✦"
git branch -M main
git remote add origin https://github.com/SEU_USUARIO/painel-vida.git
git push -u origin main
```

### 3. Deploy no Vercel

1. Acesse vercel.com
2. "Add New Project" → importe o repositório
3. Em "Environment Variables", adicione as duas variáveis acima
4. Clique em "Deploy"
5. Em ~1 minuto seu painel estará no ar!

### 4. Adicionar à tela de início (iPhone/iPad)

1. Abra o link do Vercel no **Safari**
2. Toque em **□↑** (compartilhar)
3. Selecione **"Adicionar à Tela de Início"**
4. Pronto — funciona como app! 🌸

---

## 🏦 Conectar bancos

Após o deploy, acesse seu painel → Finanças → Bancos → "Conectar novo banco"

---

## 💻 Rodar localmente

```bash
npm install
npm run dev
```

Crie um arquivo `.env.local` com:
```
VITE_PLUGGY_CLIENT_ID=seu_client_id
VITE_PLUGGY_CLIENT_SECRET=seu_client_secret
```
