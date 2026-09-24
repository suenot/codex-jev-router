# Альтернативные движки решений

Движок оценивает короткое описание задачи для субагента. Сам субагент по-прежнему использует только модель Codex. Задай `CODEX_ROUTER_DECIDER` в окружении, которое получает Codex, запусти сервер проекта или установи его библиотеку, затем выполни `npm run doctor -- --live`. Пока не проверишь альтернативу на своих задачах, оставь `jev`. Проверка соединения подтверждает формат обмена, но не качество маршрутизации или экономию.

Серверные режимы по умолчанию обращаются к loopback. `CODEX_ROUTER_DECIDER_URL` меняет адрес, `CODEX_ROUTER_DECIDER_API_KEY` добавляет bearer-токен. `CODEX_ROUTER_DECIDER_MODEL` передает имя модели только серверам с форматом Jev. `CODEX_ROUTER_DECIDER_TIMEOUT_MS` принимает 1000–600000 мс; по умолчанию 15 секунд для HTTP и 120 секунд для библиотечных и консольных мостов. При ошибке, неверном ответе или превышении времени выбирается Sol high. Адаптеры берут `confidence` из вероятности выбранного варианта; это **не** калибровка модели под пороги роутера.

| Проект | Значение | Исходный интерфейс | Подключение и ограничения |
| --- | --- | --- | --- |
| [TheoLeeCJ/SemIf-OpenJev](https://github.com/TheoLeeCJ/SemIf-OpenJev) (ранее Semif) | `semif` | Консольная программа `semif-score`, JSONL | Создает временный файл с правами 0600, записывает два вопроса, преобразует вероятности и удаляет файл. Нужны `CODEX_ROUTER_SEMIF_MODEL` и `CODEX_ROUTER_SEMIF_REVISION`. Дополнительно: `CODEX_ROUTER_SEMIF_COMMAND`, `CODEX_ROUTER_SEMIF_BACKEND`, `CODEX_ROUTER_SEMIF_DEVICE`, `CODEX_ROUTER_SEMIF_GGUF`. |
| [TianyuCodings/NanoJev](https://github.com/TianyuCodings/NanoJev) | `nanojev` | `POST /api/evaluate` | Преобразует `noul` в `boolean` и обратно. Адрес по умолчанию `127.0.0.1:8765`. Нужна контрольная точка исходного проекта. |
| [vinnylarouge/jevlike](https://github.com/vinnylarouge/jevlike) | `jevlike` | Python API модели | Загружает контрольную точку и оценивает оба вопроса. Нужна `CODEX_ROUTER_JEVLIKE_CHECKPOINT`; дополнительно `CODEX_ROUTER_JEVLIKE_DEVICE`, `CODEX_ROUTER_PYTHON`. Стандартные ограничения на число байтов во входе малы: проверь усечение текста и обучи модель под нужные задачи. |
| [featherless-ai/simple-jev](https://github.com/featherless-ai/simple-jev) | `simple-jev` | `POST /v1/classifier` | Прямой запрос формата Jev. Модель по умолчанию `Qwen/Qwen3.5-0.8B`, адрес `127.0.0.1:8000`. Если сервер использует другое имя, задай `CODEX_ROUTER_DECIDER_MODEL`. Для локальной обработки используй собственный сервер. |
| [nokia-applied-research/AnyJev](https://github.com/nokia-applied-research/AnyJev) | `anyjev` | Python `Decider` и `HFBackend` | Загружает HF-модель. Нужна `CODEX_ROUTER_ANYJEV_MODEL`; дополнительно `CODEX_ROUTER_ANYJEV_DEVICE`, `CODEX_ROUTER_ANYJEV_DTYPE`, `CODEX_ROUTER_PYTHON`. |
| [r-ms/mini-jev](https://github.com/r-ms/mini-jev) | `mini-jev` | Демонстрационный `POST /run` | Читает вероятности ветки `split`. Адрес `127.0.0.1:8765`. Этот стенд также запускает генерацию JSON, поэтому задержка и расход вычислений могут быть большими. |
| [nico-martin/open-jev](https://github.com/nico-martin/open-jev) | `open-jev-nico` | TypeScript `OpenJev.load().decide()` | Установи дополнительные пакеты `open-jev` и `@huggingface/transformers`. Необязательные переменные: `CODEX_ROUTER_OPENJEV_MODEL` (по умолчанию `kev-0.6b`), `CODEX_ROUTER_OPENJEV_DEVICE`, `CODEX_ROUTER_OPENJEV_DTYPE`. |
| [zeredy879/minojev](https://github.com/zeredy879/minojev) | `minojev` | `POST /score` | Преобразует `noul` в `boolean` и записи `records` в типизированный ответ. Адрес `127.0.0.1:8000`; нужна обученная контрольная точка. |
| [Zefan-Cai/Open-Jev](https://github.com/Zefan-Cai/Open-Jev) | `open-jev-zefan` | `POST /v1/systemone` | Прямой запрос к локальному серверу. Адрес `127.0.0.1:8791`; смотри инструкцию проекта для Docker или CPU. |
| [daseinlabs/open-jev](https://github.com/daseinlabs/open-jev) | `open-jev-dasein` | `POST /v1/systemone` | Прямой запрос к локальному серверу. Адрес `127.0.0.1:8000`; если включен ключ сервера, задай `CODEX_ROUTER_DECIDER_API_KEY`. |

Пример для работающего сервера NanoJev:

```sh
export CODEX_ROUTER_DECIDER=nanojev
npm run doctor -- --live
```

Пример для SemIf, установленного в Python-окружении:

```sh
export CODEX_ROUTER_DECIDER=semif
export CODEX_ROUTER_SEMIF_COMMAND=/absolute/path/to/semif-score
export CODEX_ROUTER_SEMIF_MODEL=Qwen/Qwen3.5-4B
export CODEX_ROUTER_SEMIF_REVISION=851bf6e806efd8d0a36b00ddf55e13ccb7b8cd0a
export CODEX_ROUTER_SEMIF_BACKEND=mlx   # Для Apple Silicon
export CODEX_ROUTER_DECIDER_TIMEOUT_MS=300000
npm run doctor -- --live
```

Пример для Python-библиотеки в виртуальном окружении:

```sh
export CODEX_ROUTER_DECIDER=anyjev
export CODEX_ROUTER_PYTHON=/absolute/path/to/venv/bin/python
export CODEX_ROUTER_ANYJEV_MODEL=Qwen/Qwen3-8B
export CODEX_ROUTER_ANYJEV_DEVICE=mps
npm run doctor -- --live
```

Каждый такой мост запускает модель заново для отдельного решения и может работать намного медленнее постоянного сервера. Пакеты и веса исходных проектов необязательны и не входят в этот репозиторий. Преобразование запросов и ответов проверено на локальных имитациях серверов и библиотек. **Реальные контрольные точки всех десяти проектов здесь не запускались**; их точность, задержка и стоимость пока не измерены.
