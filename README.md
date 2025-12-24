# Micro Ecom Demo (Node microservices + frontend)

Services:
- Product Service: http://localhost:4000/products
- Cart Service: http://localhost:4001
- Order Service: http://localhost:4002
- Frontend: http://localhost:8080

Run with Docker Compose:

```bash
docker-compose up --build
```

The frontend is intentionally minimal (plain HTML/CSS/JS) and calls the services on localhost. From inside containers the services reach each other via their compose service names (e.g., `cart-service`).
