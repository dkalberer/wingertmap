package platform

import (
	"context"
	"net/url"
	"strings"

	"github.com/minio/minio-go/v7"
	"github.com/minio/minio-go/v7/pkg/credentials"
)

func NewMinioClient(cfg *Config) (*minio.Client, error) {
	endpoint := cfg.S3Endpoint
	useSSL := strings.HasPrefix(endpoint, "https://")
	endpoint = strings.TrimPrefix(endpoint, "https://")
	endpoint = strings.TrimPrefix(endpoint, "http://")
	// strip path component if any
	if u, err := url.Parse(cfg.S3Endpoint); err == nil {
		endpoint = u.Host
	}

	client, err := minio.New(endpoint, &minio.Options{
		Creds:        credentials.NewStaticV4(cfg.S3AccessKey, cfg.S3SecretKey, ""),
		Secure:       useSSL,
		BucketLookup: minio.BucketLookupPath,
	})
	if err != nil {
		return nil, err
	}

	exists, err := client.BucketExists(context.Background(), cfg.S3Bucket)
	if err != nil {
		return nil, err
	}
	if !exists {
		if err := client.MakeBucket(context.Background(), cfg.S3Bucket, minio.MakeBucketOptions{}); err != nil {
			return nil, err
		}
	}
	return client, nil
}
