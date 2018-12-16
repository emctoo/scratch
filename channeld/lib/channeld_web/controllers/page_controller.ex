defmodule ChanneldWeb.PageController do
  use ChanneldWeb, :controller

  def index(conn, _params) do
    render(conn, "index.html")
  end
end
