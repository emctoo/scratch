defmodule ChanneldWeb.UserController do
  use Phoenix.Controller
  require Logger

  def login(conn, %{"username" => username}) do
    Logger.info("login, username: #{username}")
    json(conn, %{success: true, uid: "0x42", username: username})
  end

  def broadcast(conn, %{"topic" => topic, "event" => event, "message" => message}) do
    payload = %{
      message_id: 0,
      ref: 0,
      created_at: ChanneldWeb.GroupChannel.now(),
      uid: 0,
      username: 0,
      content: message
    }

    Logger.info("broadcast ...")
    ChanneldWeb.Endpoint.broadcast!(topic, event, payload)
    json(conn, %{success: true})
  end

  def presence_list(conn, %{"topic" => topic}) do
    json(conn, Phoenix.Presence.list(ChanneldWeb.Presence, topic))
  end
end
