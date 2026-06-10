# Image metadata and config.
# Ideally, the Node.js version should match what we use on CI.
FROM cimg/node:24.16.0-browsers@sha256:9b9135c5aed37aa84af084d94a54473483712de622b4f07119bcc24e16b0491e

LABEL name="Angular dev environment" \
  description="This image can be used to create a dev environment for building Angular." \
  vendor="angular" \
  version="1.0"

EXPOSE 4200 4201 4205 4206 9876

# Switch to `root`.
USER root

# Go! (And keep going.)
CMD ["tail", "--follow", "/dev/null"]
