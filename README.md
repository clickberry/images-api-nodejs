# Dockerized Images API
Images API micro-service on Node.js. The API is used for uploading arbitrary images to the S3 bucket.

* [Architecture](#architecture)
* [Technologies](#technologies)
* [Environment Variables](#environment-variables)
* [API](#api)
* [License](#license)

# Architecture
The application is a REST API with database (Redis) and AWS (S3) dependencies.

# Technologies
* Node.js
* Redis/node_redis
* Express.js
* AWS S3

# Environment Variables
The service should be properly configured with following environment variables.

Key | Value | Description
:-- | :-- | :-- 
REDIS_ADDRESS | redis.yourdomain.com | Redis server address.
REDIS_PORT | 6379 | Redis server port.
TOKEN_ACCESSSECRET | MDdDRDhBOD*** | Access token secret.
MAX_FILE_SIZE | 1024 * 1024 * 10 | Maximum file size.

# API

## GET /{id}
Gets an image by id.

### Response
| HTTP       | Value     |
|------------|-----------|
| StatusCode | 200       |
| Body       | { "id": *id*, "url": *image_url* } |

## POST /
Uploads an image file.

### Request
| Header   | Value |
|----------|-------------|
| Authorization     | JWT [accessToken] |
| Content-Type      | multipart/form-data |

| Body    | Description |
|----------|-------------|
| File | Arbitraty image file of size <= 10MB (by default) |

### Response
| HTTP       | Value     |
|------------|-----------|
| StatusCode | 201       |
| Body       | { "id": *id*, "url": *image_url* } |

## DELETE /{id}
Deletes an image by id.

### Request
| Header   | Value |
|----------|-------------|
| Authorization     | JWT [accessToken] |

### Response
| HTTP       |  Value                                                             |
|------------|--------------------------------------------------------------------|
| StatusCode | 200                                                                |

# License
Source code is under GNU GPL v3 [license](LICENSE).
