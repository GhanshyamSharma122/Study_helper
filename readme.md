# study-helper
This is a quiz maker app which you can use for educational purposes.

## AI provider
MCQ generation is powered by the local **DeepSeek proxy** (FreeDeepseekAPI-EN),
which exposes an OpenAI-compatible endpoint. Configure the following in `.env`:

```
DEEPSEEK_BASE_URL="http://127.0.0.1:9655/v1"
DEEPSEEK_MODEL="deepseek-reasoner"
DEEPSEEK_API_KEY=""
```

`DEEPSEEK_API_KEY` is only required if the proxy was started with `PROXY_API_KEY`;
otherwise it is ignored and `AI_KEY` is used as a fallback.

Also configure `PORT` and `CORS_ORIGIN` in `.env`.

Start the proxy first (see `FreeDeepseekAPI-EN/docs/INTEGRATION.md`), then run the app.
