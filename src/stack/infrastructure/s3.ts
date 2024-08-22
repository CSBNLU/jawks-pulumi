import * as aws from "@pulumi/aws";
import * as pulumi from "@pulumi/pulumi";

export interface Props {
  jwksFileKey: string;
  prefix: string;
  providedBucket?: aws.s3.BucketV2;
}

export const jwksBucketResourceName = (prefix: string) =>
  `${prefix}-jwks-bucket`;

export const configureJwksBucket = (props: Props): aws.s3.BucketV2 => {
  const { jwksFileKey, prefix, providedBucket } = props;
  const bucketResourceName = `${prefix}-jwks-bucket`;
  const bucket = providedBucket ?? jwksBucket({ bucketResourceName });
  const bucketPublicAccessBlock = updateBucketPublicAccess({
    bucket,
    bucketResourceName,
  });
  addJwksFilePolicyToBucket({
    bucket,
    bucketPublicAccessBlock,
    bucketResourceName,
    jwksFileKey,
  });

  return bucket;
};

export const jwksBucket = (props: {
  bucketResourceName: string;
}): aws.s3.BucketV2 => {
  const { bucketResourceName } = props;

  const bucket = new aws.s3.BucketV2(bucketResourceName, {
    forceDestroy: true,
  });

  return bucket;
};

export const updateBucketPublicAccess = (props: {
  bucket: aws.s3.BucketV2;
  bucketResourceName: string;
}): aws.s3.BucketPublicAccessBlock => {
  const { bucket, bucketResourceName } = props;

  return new aws.s3.BucketPublicAccessBlock(
    `${bucketResourceName}-publicAccessBlock`,
    {
      bucket: bucket.id,
      blockPublicAcls: true,
      blockPublicPolicy: false,
      ignorePublicAcls: true,
      restrictPublicBuckets: false,
    },
  );
};

export const addJwksFilePolicyToBucket = (props: {
  bucket: aws.s3.BucketV2;
  bucketPublicAccessBlock: aws.s3.BucketPublicAccessBlock;
  bucketResourceName: string;
  jwksFileKey: string;
}): aws.s3.BucketV2 => {
  const { bucket, bucketPublicAccessBlock, bucketResourceName, jwksFileKey } =
    props;

  const bucketPolicy = new aws.s3.BucketPolicy(
    `${bucketResourceName}-bucket-policy`,
    {
      bucket: bucket.bucket, // Referencing the bucket created earlier
      policy: bucket.bucket.apply((bucketName) =>
        JSON.stringify({
          Version: "2012-10-17",
          Statement: [
            {
              Effect: "Allow",
              Principal: "*",
              Action: "s3:GetObject",
              Resource: `arn:aws:s3:::${bucketName}/${jwksFileKey}`,
            },
          ],
        }),
      ),
    },
    { dependsOn: [bucketPublicAccessBlock] },
  );

  return bucket;
};
