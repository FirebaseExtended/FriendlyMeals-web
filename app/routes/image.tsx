/* eslint-disable react-refresh/only-export-components */
import ImageLayout from "../components/ImageLayout";

export function meta() {
    return [
        { title: "Scan Recipe - Friendly Meals" },
        { name: "description", content: "Scan an image to extract a recipe" },
    ];
}

export default function ImagePage() {
    return <ImageLayout />;
}
