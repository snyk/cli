defmodule Snowflex.MixProject do
  use Mix.Project

  def project do
    [
      app: :snowflex,
      version: "0.3.1",
      elixir: "~> 1.9",
      start_permanent: Mix.env() == :prod,
      deps: deps(),
      description: description(),
      package: package(),
      name: "Snowflex"
    ]
  end

  # Run "mix help compile.app" to learn about applications.
  def application do
    [
      extra_applications: [:logger, :odbc],
      env: [
        driver: "/usr/lib/snowflake/odbc/lib/libSnowflake.so"
      ]
    ]
  end

  defp description do
    """
    The client interface for connecting to the Snowflake data warehouse.
    """
  end

  defp package do
    [
      # These are the default files included in the package
      files: ~w(lib .formatter.exs mix.exs README* LICENSE* CHANGELOG*),
      licenses: ["Apache-2.0"],
      links: %{"GitHub" => "https://github.com/pepsico-ecommerce/snowflex"}
    ]
  end

  defp deps do
    [
      {:pow, "1.0.15"},
      {:poolboy, "~> 1.5.1"},
      {:backoff, "~> 1.1.6"},
      {:ecto, "~> 3.0"},
      {:dialyxir, "~> 1.0", only: [:dev, :prod], runtime: false},
      {:ex_doc, "~> 0.21", only: :dev, runtime: false},
      {:meck, "~> 0.9", only: :test}
    ]
  end
end
