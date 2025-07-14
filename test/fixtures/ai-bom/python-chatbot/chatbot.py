"""
Detects model usage. Note that the model name string is not passed directly
to the model loading function, so this showcases our ability to follow code flow.
"""

import os

import anthropic
from anthropic import Client


def init() -> tuple[Client, str]:
    key = "ANTHROPIC_API_KEY"
    if key not in os.environ:
        print(f"{key} not set in environment.")
        exit(1)
    client = anthropic.Anthropic()
    return client, "claude-3-5-sonnet-20240620"


def main() -> None:
    client, model = init()
    while True:
        prompt = input("> ")
        if prompt == "exit":
            break
        response = client.messages.create(
            model=model,
            max_tokens=1024,
            messages=[{"role": "user", "content": prompt}],
        )
        print(response.content[0].text)


if __name__ == "__main__":
    main()