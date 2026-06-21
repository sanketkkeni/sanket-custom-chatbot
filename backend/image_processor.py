import json
import io
import boto3
from PIL import Image

s3 = boto3.client('s3')

MAX_SIZE = 3.5 * 1024 * 1024
TARGET_SIZE = 3.5 * 1024 * 1024


def lambda_handler(event, context):
    for record in event.get('Records', []):
        bucket = record['s3']['bucket']['name']
        key = record['s3']['object']['key']

        if not any(key.lower().endswith(ext) for ext in ['.jpg', '.jpeg', '.png']):
            continue

        size = record['s3']['object']['size']
        if size <= MAX_SIZE:
            continue

        try:
            tags = s3.get_object_tagging(Bucket=bucket, Key=key)
            if any(t['Key'] == 'bedrock_processed' and t['Value'] == 'true' for t in tags['TagSet']):
                continue
        except Exception:
            pass

        response = s3.get_object(Bucket=bucket, Key=key)
        image_data = response['Body'].read()
        content_type = response.get('ContentType', '')

        compressed = _compress(image_data, key)

        s3.put_object(
            Bucket=bucket,
            Key=key,
            Body=compressed,
            ContentType=content_type or 'image/jpeg',
            Metadata={'bedrock_processed': 'true'}
        )

        s3.put_object_tagging(
            Bucket=bucket,
            Key=key,
            Tagging={'TagSet': [{'Key': 'bedrock_processed', 'Value': 'true'}]}
        )


def _compress(data, key):
    img = Image.open(io.BytesIO(data))

    if img.mode in ('RGBA', 'P', 'LA'):
        img = img.convert('RGB')

    fmt = 'JPEG'
    buf = io.BytesIO()

    for quality in [85, 75, 65, 55, 45, 35, 25, 20]:
        buf.seek(0)
        buf.truncate()
        img.save(buf, format=fmt, quality=quality, optimize=True)
        if buf.tell() <= TARGET_SIZE:
            return buf.getvalue()

    w, h = img.size
    while w > 400 or h > 400:
        w = int(w * 0.8)
        h = int(h * 0.8)
        img_resized = img.resize((w, h), Image.LANCZOS)
        buf.seek(0)
        buf.truncate()
        img_resized.save(buf, format=fmt, quality=45, optimize=True)
        if buf.tell() <= TARGET_SIZE:
            return buf.getvalue()

    return buf.getvalue()
