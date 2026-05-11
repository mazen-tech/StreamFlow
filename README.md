## Uruchomienie – krok po kroku

### 1. Inicjalizacja bazy danych (tylko raz)

```bash
cd streamflow-backend
python3 init_db.py
```

Tworzy plik `streamflow.db` z:
- 6 kategoriami
- 15 filmami i serialami
- 3 planami cenowymi
- Łącznie 24 rekordy

### 2. Start serwera

```bash
python3 server.py
# lub z własnym portem:
python3 server.py 3000
```
