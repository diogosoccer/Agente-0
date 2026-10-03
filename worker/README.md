# Agente Zero — Browser Worker

Camada local opcional para permitir que o Agente Zero execute tarefas de navegador aprovadas pelo usuário.

## O que ele faz
- abre uma URL;
- inspeciona título e texto público de uma página;
- captura screenshot;
- expõe estado em `/health`;
- rejeita tarefas sem aprovação.

## O que ele não faz
- não envia mensagens automaticamente;
- não compra nada;
- não movimenta dinheiro;
- não cria contas em massa;
- não coleta credenciais;
- não burla proteções de sites.

## Rodar localmente

```bash
cd worker
npm install
npx playwright install chromium
npm start
```

Depois, no Agente Zero, informe `http://localhost:8787` como endereço do executor.

O worker é local: publicar o dashboard na internet não dá acesso ao computador do usuário. O worker precisa ser iniciado no computador que executará o navegador.
