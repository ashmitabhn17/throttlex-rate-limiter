# 🎤 ThrottleX — 2 to 3 Minute Presentation Guide

This guide gives you an interview-ready, high-scoring presentation script and demo walkthrough to showcase your running deployed project.

---

## ⏱️ Presentation Timing Breakdown (Total: 2:30 min)

| Time | Section | Focus |
|---|---|---|
| **0:00 – 0:30** | The Hook & Problem | Why API rate limiting is critical and why naive rate limiters fail under load |
| **0:30 – 1:15** | Architecture & Algorithmic Design | Redis + Token Bucket + Atomic Lua scripts to prevent race conditions |
| **1:15 – 1:45** | Cloud & DevOps Pipeline | Docker containerization, Amazon ECR, Amazon EC2, GitHub Actions CI/CD |
| **1:45 – 2:30** | Live Working Demo | Live API call (200 OK), Rate limit burst (429 Too Many Requests), Dashboard |

---

## 🗣️ Word-for-Word Spoken Script

> *"Good morning / afternoon! Today I am presenting **ThrottleX**, a high-performance, containerized API protection microservice deployed on AWS.*
>
> *(0:00 - 0:30: Problem Statement)*  
> *Most modern web services suffer from scrapers, DDoS bursts, or API abuse. A common mistake developers make is building in-memory rate limiters or using a naive 'GET counter, check, then increment' pattern. In distributed systems, this creates severe race conditions—under high concurrency, two requests can read the same counter simultaneously and both succeed, overselling capacity.*
>
> *(0:30 - 1:15: Solution & Architecture)*  
> *To solve this, I designed ThrottleX using a distributed **Token Bucket algorithm** powered by **Redis** and an atomic **Lua script**. The entire read-refill-check-consume cycle runs atomically on Redis, preventing race conditions completely. In our automated test suite, we verify this by firing 50 concurrent requests in parallel at a capacity-5 bucket, and exactly 5 requests succeed while 45 are blocked.*
>
> *Durable data—like admin accounts, hashed API keys, and audit logs—is stored in PostgreSQL using Prisma ORM. Note that raw API keys are never stored; only cryptographic SHA-256 hashes are persisted.*
>
> *(1:15 - 1:45: DevOps & Cloud Architecture)*  
> *For deployment, I followed industry DevOps best practices:*
> 1. *I containerized the microservice using multi-stage Docker builds to keep images lightweight and secure.*
> 2. *I established a CI/CD pipeline using **GitHub Actions**, which spins up live PostgreSQL and Redis service containers, runs 8 automated test cases, and automatically blocks the build or PR if any test fails.*
> 3. *Once tests pass, the container image is pushed to **Amazon Elastic Container Registry (ECR)**.*
> 4. *Finally, the service is deployed live on an **AWS EC2 Ubuntu instance**, accessible over the internet.*
>
> *(1:45 - 2:30: Live Demo)*  
> *Let me demonstrate the live deployed application:*
> - *First, here is our health check endpoint at `http://<EC2-IP>:4000/health` returning 200 OK.*
> - *Now, I make a request to our protected search API passing an API key header. As you can see in the response headers, ThrottleX attaches `X-RateLimit-Limit`, `X-RateLimit-Remaining`, and reset windows.*
> - *Next, I trigger a rapid burst exceeding our configured rule capacity. Immediately, the service responds with HTTP **429 Too Many Requests** and a `Retry-After` header.*
> - *In our dashboard, we can see the real-time request logs, analytics graphs, and manage rate limit rules on the fly without restarting the service.*
>
> *Thank you! I would be glad to answer any questions about the architecture or deployment."*

---

## 🎬 Live Demo Action Checklist (What to Click & Show)

Have the following tabs open before your turn:
1. **Tab 1: AWS Console / EC2 Dashboard**  
   Show the running `throttlex-server` instance and its Public IPv4 address.
2. **Tab 2: Health Check in Browser**  
   Open `http://<EC2-IP>:4000/health` → shows `{"status":"ok","service":"throttlex-backend"}`.
3. **Tab 3: Terminal or Postman / Frontend Playground**  
   - Send 1 request: show `200 OK` and inspect `X-RateLimit-Remaining: 19`.
   - Send fast repeated requests: show `429 Too Many Requests` with `Retry-After: 3`.
4. **Tab 4: GitHub Repository**  
   Show the green checkmark from GitHub Actions CI passing all 8 tests!

---

## 💡 Potential Questions & Winning Answers

### Q1: Why did you use Redis Lua scripts instead of standard Redis INCR?
> **Answer**: `INCR` only handles simple incrementing counters (fixed window). Token Bucket requires calculating continuous refill based on elapsed time, checking remaining tokens, subtracting, and updating the timestamp. Without Lua scripts, doing this across multiple Redis commands (`GET`, `SET`) creates a race condition where multiple servers interleave. Redis Lua scripts execute completely atomically.

### Q2: What happens if Redis goes down in production?
> **Answer**: ThrottleX has a configurable **Fail-Open / Fail-Closed** strategy (`RATE_LIMIT_FAIL_OPEN=true`). In fail-open mode, if Redis is temporarily unreachable, requests are allowed through with an `X-RateLimit-Degraded: true` header to preserve API availability rather than crashing the business.

### Q3: How do you prevent hot-key bottlenecks in Redis?
> **Answer**: Each API key and route has its own namespaced key (`rl:{apiKeyHash}:plan:routeHash`). Because the tenant hash is first and wrapped in Redis cluster hash tags `{apiKeyHash}`, load naturally distributes across Redis cluster nodes rather than funneling into a single hot key.
