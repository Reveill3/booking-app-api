module.exports = ({ env }) => ({
  connection: {
    client: "mysql",
    connection: {
      host: env("DATABASE_HOST", "217.21.76.201"),
      port: env.int("DATABASE_PORT", 3306),
      database: env("DATABASE_NAME", "u530416664_bookingApp"),
      user: env("DATABASE_USERNAME", "u530416664_bookingAdmin"),
      password: env("DATABASE_PASSWORD", "w%fr5KDYE$Y525"),
      ssl: env.bool("DATABASE_SSL", false),
    },
  },
});
