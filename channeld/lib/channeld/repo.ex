defmodule Channeld.Repo do
  use Ecto.Repo,
    otp_app: :channeld,
    adapter: Ecto.Adapters.Postgres
end
