defmodule ChanneldWeb.Router do
  use ChanneldWeb, :router

  pipeline :browser do
    plug(:accepts, ["html"])
    plug(:fetch_session)
    plug(:fetch_flash)
    plug(:protect_from_forgery)
    plug(:put_secure_browser_headers)
  end

  pipeline :api do
    plug(:accepts, ["json"])
  end

  scope "/", ChanneldWeb do
    pipe_through(:browser)

    get("/", PageController, :index)
  end

  scope "/api", ChanneldWeb do
    pipe_through(:api)

    post("/login", UserController, :login)
    post("/event/:business", UserController, :broadcast)
    get("/presence", UserController, :presence_list)
  end
end
