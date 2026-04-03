from langchain_groq import ChatGroq
from langchain_core.messages import AIMessage, SystemMessage
from langgraph.graph import StateGraph
from typing import TypedDict, List
try:
    from .config import Config
except ImportError:
    from config import Config

llm = ChatGroq(
    groq_api_key=Config.GROQ_API_KEY,
    model="llama-3.1-8b-instant"
)

class State(TypedDict):
    messages: List


SYSTEM_PROMPT = (
    "You are a helpful assistant. "
    "Answer clearly and directly. "
    "Do not repeat your previous response verbatim."
)


def call_model(state):
    history = state["messages"]
    response = llm.invoke([SystemMessage(content=SYSTEM_PROMPT), *history])

    last_ai_message = next(
        (message for message in reversed(history) if isinstance(message, AIMessage)),
        None,
    )

    # If the model repeats exactly, ask for a reformulated answer one time.
    if last_ai_message and response.content.strip() == last_ai_message.content.strip():
        response = llm.invoke(
            [
                SystemMessage(content=SYSTEM_PROMPT),
                *history,
                SystemMessage(
                    content="Rephrase and improve the answer. Add useful new detail and avoid repetition."
                ),
            ]
        )

    return {"messages": history + [response]}

graph = StateGraph(State)
graph.add_node("chatbot", call_model)
graph.set_entry_point("chatbot")
app_graph = graph.compile()

def get_response(history):
    result = app_graph.invoke({"messages": history})
    return result["messages"][-1]