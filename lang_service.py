import os

from langchain_community.document_loaders import PyPDFLoader
from langchain_community.document_loaders import TextLoader
from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_community.vectorstores import FAISS
from langchain_community.embeddings import HuggingFaceEmbeddings
from langchain_core.prompts import ChatPromptTemplate
from langchain_core.output_parsers import StrOutputParser
from langchain_core.runnables import RunnablePassthrough
from langchain_groq import ChatGroq

VECTOR_STORE_PATH = "vectorstores"


# ================= CREATE VECTOR STORE =================
def create_vectorstore(filepath, chat_id):
    extension = os.path.splitext(filepath)[1].lower()

    if extension == ".pdf":
        loader = PyPDFLoader(filepath)
    else:
        # Try UTF-8 first, then automatically detect compatible text encodings.
        loader = TextLoader(filepath, encoding="utf-8", autodetect_encoding=True)

    documents = loader.load()

    if not documents or not any(doc.page_content.strip() for doc in documents):
        raise ValueError("Uploaded file has no readable text content")

    splitter = RecursiveCharacterTextSplitter(
        chunk_size=500,
        chunk_overlap=100
    )

    docs = splitter.split_documents(documents)

    embeddings = HuggingFaceEmbeddings(
        model_name="sentence-transformers/all-MiniLM-L6-v2"
    )

    vectorstore = FAISS.from_documents(docs, embeddings)

    path = os.path.join(VECTOR_STORE_PATH, str(chat_id))
    os.makedirs(path, exist_ok=True)

    vectorstore.save_local(path)


# ================= GET RAG RESPONSE =================
def get_rag_response(chat_id, query):
    path = os.path.join(VECTOR_STORE_PATH, str(chat_id))

    embeddings = HuggingFaceEmbeddings(
        model_name="sentence-transformers/all-MiniLM-L6-v2"
    )

    vectorstore = FAISS.load_local(
        path,
        embeddings,
        allow_dangerous_deserialization=True
    )

    retriever = vectorstore.as_retriever()

    llm = ChatGroq(
        model="llama-3.1-8b-instant",
        temperature=0
    )

    # 🔥 Modern RAG Chain (LCEL)
    prompt = ChatPromptTemplate.from_template(
        """Answer the question based only on the context below.

Context:
{context}

Question:
{question}
"""
    )

    def format_docs(docs):
        return "\n\n".join(doc.page_content for doc in docs)

    rag_chain = (
        {
            "context": retriever | format_docs,
            "question": RunnablePassthrough(),
        }
        | prompt
        | llm
        | StrOutputParser()
    )

    return rag_chain.invoke(query)