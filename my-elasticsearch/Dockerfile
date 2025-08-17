# Image Elasticsearch chính thức
FROM docker.elastic.co/elasticsearch/elasticsearch:8.13.4

# Chạy ở chế độ single node
ENV discovery.type=single-node
# Giới hạn RAM để không vượt quota Render (tối thiểu 512MB, nên 1GB cho chắc)
ENV ES_JAVA_OPTS="-Xms512m -Xmx512m"

# Mở port mặc định
EXPOSE 9200
