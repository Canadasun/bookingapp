tunnel: 93d9a63b-0aea-42ab-99a7-6c2961e5fa8d
credentials-file: /Users/test/.cloudflared/93d9a63b-0aea-42ab-99a7-6c2961e5fa8d.json

ingress:
  - hostname: dev-booking.pulseappointments.com
    service: http://localhost:3000
  - hostname: mobile-dev.pulseappointments.com
    service: http://localhost:8081
  - service: http_status:404