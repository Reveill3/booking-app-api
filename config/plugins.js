module.exports = ({ env }) => ({
  upload: {
    config: {
      provider: "cloudinary",
      providerOptions: {
        cloud_name: env("CLOUDINARY_NAME"),
        api_key: env("CLOUDINARY_KEY"),
        api_secret: env("CLOUDINARY_SECRET"),
      },
      actionOptions: {
        upload: {},
        uploadStream: {},
        delete: {},
      },
    },
  },
  "users-permissions": {
    config: {
      jwt: {
        expiresIn: "7d",
      },
    },
  },
  email: {
    config: {
      provider: "nodemailer",
      providerOptions: {
        host: "smtp.gmail.com",
        port: 465,
        auth: {
          user: env("GMAIL_ADDRESS"),
          pass: env("GMAIL_PASS"),
        },
        // ... any custom nodemailer options
      },
      settings: {
        defaultFrom: "reservations@revrentals.net",
        defaultReplyTo: "austin@revrentals.net",
      },
    },
  },
});
