window.SNEAKER_M01_HTTP = {
  "checks": [
    "GET /health returns 200 with live database",
    "/docs serves Swagger HTML",
    "/openapi.json includes GET /health",
    "stopped database returns bounded 503",
    "/docs remains available while DB is stopped",
    "same API process recovers to 200"
  ],
  "health": [
    {
      "stage": "up",
      "status": 200,
      "body": {
        "status": "ok"
      }
    },
    {
      "stage": "stopped",
      "status": 503,
      "body": {
        "status": "unavailable"
      }
    },
    {
      "stage": "recovered",
      "status": 200,
      "body": {
        "status": "ok"
      }
    }
  ]
};
