defmodule ChanneldWeb.GroupChannel do
  use Phoenix.Channel
  require Logger

  alias ChanneldWeb.Presence

  def join("group:system", %{"username" => username, "uid" => uid} = message, socket) do
    Process.flag(:trap_exit, true)

    Logger.info("#### group: group:system, id: #{uid} joins, message: #{inspect(message)}")

    send(self(), {:after_join, %{uid: socket.assigns.uid, username: message["username"]}})

    # 系统时间
    :timer.send_interval(1000, :time)

    {:ok, socket}
  end

  # TODO: tid的引入导致和其他服务不兼容
  # def join("group:" <> room_id, _message, %{tid: tid}) when room_id != tid,
  #   do: {:error, %{reason: 'unauthroized'}}

  def join("group:" <> room_id, message, socket) do
    Logger.info("**** #{socket.assigns.uid} joins #{room_id}, message: #{inspect(message)}")

    socket = assign(socket, :username, message["username"])
    send(self(), {:after_join, %{uid: socket.assigns.uid, username: message["username"]}})
    {:ok, socket}
  end

  def handle_info({:after_join, %{uid: uid, username: username} = message}, socket) do
    Logger.info("message: #{inspect(message)}")

    # broadcast!(socket, "user:entered", %{id: uid})
    # push(socket, "join", %{status: "connected"})

    # 列出当前presence
    presences = Presence.list(socket)
    Logger.info("presences: #{inspect(presences, pretty: true)}")

    push(socket, "presence_state", presences)

    metas = %{
      uid: uid,
      username: username,
      online_at: inspect(System.system_time(:seconds))
    }

    {:ok, _} = Presence.track(socket, socket.assigns.uid, metas)

    {:noreply, socket}
  end

  def handle_info(:time, socket) do
    body = %{user: "SYSTEM", body: now()}
    push(socket, "time", %{user: "SYSTEM", body: body})

    {:noreply, socket}
  end

  def handle_info(:qrcode, socket) do
    body = %{user: "SYSTEM", body: Base.encode64(now())}
    push(socket, "qrcode", %{user: "SYSTEM", body: body})

    {:noreply, socket}
  end

  def terminate(reason, socket) do
    Logger.debug(
      "> #{socket.assigns.username}(#{socket.assigns.uid}) leave #{socket.topic} #{
        inspect(reason)
      }"
    )

    :ok
  end

  def handle_in(event, message, socket) do
    Logger.info("event: #{event}, message: #{inspect(message, pretty: true)}")

    new_message = %{
      message_id: 0,
      ref: socket.ref,
      created_at: now(),
      uid: socket.assigns.uid,
      username: socket.assigns.username,
      content: message
    }

    broadcast!(socket, event, new_message)
    {:reply, {:ok, %{message: message}}, assign(socket, :user, message["user"])}
  end

  def now do
    Calendar.DateTime.now!("Asia/Shanghai") |> Calendar.Strftime.strftime!("%F %T")
  end
end
