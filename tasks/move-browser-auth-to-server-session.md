# Перевести авторизацию на серверную сессию

Status: blocked by deployment. Контракт согласован, API и миграция merged;
рабочие API/БД пока не готовы. См. [проверку deployment](../docs/browser-session-readiness.md).

Priority: P2

## Проблема

Фронтенд сохраняет username и password в `localStorage`, затем отправляет их через Basic Authorization. Любой JavaScript-код, исполняемый в origin приложения, может прочитать постоянный пароль.

## Что сделать

- После подтверждённого deployment подключить согласованные v2 password/passkey login, `/me` и DELETE logout.
- Хранить сессии в Go API и PostgreSQL; браузер получает `HttpOnly`, `Secure`, `SameSite=Lax` cookie. Node BFF не хранит credentials или токены пользователя.
- Обращаться к `/api/...` на публичном origin через reverse proxy, сохраняя Origin для серверной CSRF-проверки.
- В dev-прокси адаптировать только Secure для локального HTTP, сохраняя простой `make dev`.
- Удалить `gkfeed.credentials`, потребовать один повторный вход, убрать Basic Auth и пароль из состояния.

## Критерии приёмки

- После входа пароль отсутствует в `localStorage`, `sessionStorage` и доступном JavaScript состоянии.
- Перезагрузка страницы восстанавливает действующую сессию.
- Logout инвалидирует серверную сессию.
- Cookie имеет согласованные безопасные атрибуты.
- Изменяющие запросы защищены от CSRF.
- Миграция удаляет старые credentials из браузера.
